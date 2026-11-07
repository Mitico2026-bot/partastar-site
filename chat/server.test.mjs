// Tests for chat/server.mjs. No dependencies; runs the real server against a stub Ollama on loopback.
//
//   node chat/server.test.mjs        (or: node --test chat/server.test.mjs)
//
// Covers the security-audit findings: crash on malformed input, rate-limit key trust,
// limiter cost under a flood, and the global bound on model work.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createLimiter } from "./rate-limit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const children = [];
after(() => children.forEach((c) => c.kill()));

// Stub Ollama: /api/tags lists the model; /api/chat streams "ok" lines, or holds the stream open
// when the prompt says "hold", recording what it was asked and whether the caller hung up.
function startStub() {
  const stub = { calls: [], open: 0, aborted: 0 };
  stub.server = http.createServer((req, res) => {
    if (req.url === "/api/tags") { res.end(JSON.stringify({ models: [{ name: "stub:1" }] })); return; }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      stub.calls.push(j);
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      if (j.messages.at(-1).content.includes("hold")) {
        stub.open++;
        res.write(JSON.stringify({ message: { content: "..." } }) + "\n");
        res.on("close", () => { stub.open--; stub.aborted++; });
        return; // never finishes on its own
      }
      res.end(JSON.stringify({ message: { content: "ok" } }) + "\n");
    });
  });
  return new Promise((r) => stub.server.listen(0, "127.0.0.1", () => { stub.port = stub.server.address().port; r(stub); }));
}

async function startServer(stub, env = {}) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [join(here, "server.mjs")], {
    cwd: here,
    env: { PATH: process.env.PATH, PORT: String(port), OLLAMA_URL: `http://127.0.0.1:${stub.port}`, OLLAMA_MODEL: "stub:1", ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  children.push(child);
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  await new Promise((resolve, reject) => {
    child.stdout.once("data", resolve);
    child.once("exit", (code) => reject(new Error("server exited " + code + ": " + log)));
  });
  return { port, child, log: () => log, alive: () => child.exitCode === null && child.signalCode === null };
}

// One HTTP request; `from` picks the client's source address (127.0.0.2 = "not this computer").
function request(port, { method = "POST", path = "/chat", headers = {}, body, from } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers, localAddress: from, agent: false }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}
const ask = (text) => ({ lang: "en", messages: [{ role: "user", content: text }] });
const json = { "Content-Type": "application/json" };

// Raw request line, for request-targets Node's client refuses to send.
function rawRequest(port, text) {
  return new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1", () => s.write(text));
    let data = "";
    s.on("data", (c) => (data += c));
    s.on("close", () => resolve(data));
    s.on("error", () => resolve(data));
  });
}

test("malformed bodies and request-targets get 400 and do not crash the server", async () => {
  const stub = await startStub();
  const srv = await startServer(stub);
  for (const body of ["null", "1", '"x"', "[]", "{}", "{bad json"]) {
    const r = await request(srv.port, { headers: json, body, from: "127.0.0.2" });
    assert.equal(r.status, 400, `body ${body}`);
  }
  for (const target of ["//[", "http://["]) {
    const out = await rawRequest(srv.port, `GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    assert.match(out, /^HTTP\/1\.1 400/, `target ${target}`);
  }
  assert.ok(srv.alive(), "server still running");
  assert.equal((await request(srv.port, { method: "GET", path: "/health" })).status, 200);
  stub.server.close();
});

test("CF-Connecting-IP is ignored unless the request comes from this computer", async () => {
  const stub = await startStub();
  const srv = await startServer(stub);
  // From another address: rotating the header must not get a fresh limit.
  const remote = [];
  for (let i = 0; i < 12; i++) remote.push((await request(srv.port, { headers: { ...json, "CF-Connecting-IP": `198.51.100.${i}` }, body: ask("hi"), from: "127.0.0.2" })).status);
  assert.deepEqual(remote, [...Array(10).fill(200), 429, 429]);
  // From loopback (where cloudflared runs), the header identifies the visitor.
  const viaTunnel = [];
  for (let i = 0; i < 12; i++) viaTunnel.push((await request(srv.port, { headers: { ...json, "CF-Connecting-IP": `203.0.113.${i}` }, body: ask("hi"), from: "127.0.0.1" })).status);
  assert.deepEqual(viaTunnel, Array(12).fill(200));
  stub.server.close();
});

test("rate limiter: rejected requests cost constant time and add no state", () => {
  let clock = 0;
  const lim = createLimiter({ perWindow: 10, windowMs: 60_000, maxKeys: 100, now: () => clock });
  const results = Array.from({ length: 12 }, () => lim.limited("198.51.100.9"));
  assert.deepEqual(results, [...Array(10).fill(false), true, true]);
  // A flood from one visitor: state stays one small entry, and late calls are as cheap as early ones.
  const time = (n) => { const t = performance.now(); for (let i = 0; i < n; i++) lim.limited("198.51.100.9"); return performance.now() - t; };
  const early = time(50_000);
  const late = time(50_000);
  assert.equal(lim.size, 1);
  assert.equal(lim.entry("198.51.100.9").count, 10);
  assert.ok(late < early * 3 + 5, `late calls ${late.toFixed(1)} ms vs early ${early.toFixed(1)} ms`);
  // The window resets after a minute.
  clock += 60_000;
  assert.equal(lim.limited("198.51.100.9"), false);
});

test("rate limiter: number of tracked visitors is capped", () => {
  let clock = 0;
  const lim = createLimiter({ perWindow: 10, windowMs: 60_000, maxKeys: 100, now: () => clock });
  for (let i = 0; i < 10_000; i++) lim.limited("key-" + i);
  assert.equal(lim.size, 100);
  clock += 60_000;
  lim.sweep();
  assert.equal(lim.size, 0);
});

test("a single-key flood over HTTP only lets 10 requests through to the model", async () => {
  const stub = await startStub();
  const srv = await startServer(stub, { MAX_CONCURRENT: "100" }); // isolate the rate limiter from the busy limit
  const agent = new http.Agent({ keepAlive: true, maxSockets: 8 });
  const once = () => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: srv.port, method: "POST", path: "/chat", headers: json, agent }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.end(JSON.stringify(ask("hi")));
  });
  const codes = await Promise.all(Array.from({ length: 2000 }, once));
  agent.destroy();
  assert.equal(codes.filter((c) => c === 200).length, 10);
  assert.equal(codes.filter((c) => c === 429).length, 1990);
  assert.equal(stub.calls.length, 10);
  stub.server.close();
});

test("only MAX_CONCURRENT answers run at once; others get 503 busy", async () => {
  const stub = await startStub();
  const srv = await startServer(stub, { MAX_CONCURRENT: "2" });
  const holds = [1, 2].map((i) => {
    const req = http.request({ host: "127.0.0.1", port: srv.port, method: "POST", path: "/chat", headers: { ...json, "CF-Connecting-IP": `192.0.2.${i}` } });
    req.on("error", () => {});
    req.end(JSON.stringify(ask("hold")));
    return req;
  });
  while (stub.open < 2) await new Promise((r) => setTimeout(r, 20));
  const third = await request(srv.port, { headers: { ...json, "CF-Connecting-IP": "192.0.2.3" }, body: ask("hi") });
  assert.equal(third.status, 503);
  assert.equal(JSON.parse(third.body).error, "busy");
  holds.forEach((r) => r.destroy()); // visitors close the chat: their answers are cancelled
  while (stub.open > 0) await new Promise((r) => setTimeout(r, 20));
  const after = await request(srv.port, { headers: { ...json, "CF-Connecting-IP": "192.0.2.4" }, body: ask("hi") });
  assert.equal(after.status, 200, "slots are released after the answers end");
  stub.server.close();
});

test("each answer has a length limit and a time limit", async () => {
  const stub = await startStub();
  const srv = await startServer(stub, { MAX_TOKENS: "321", ANSWER_TIMEOUT_MS: "400" });
  const t = performance.now();
  const r = await request(srv.port, { headers: json, body: ask("hold") });
  const took = performance.now() - t;
  assert.equal(r.status, 200);
  assert.ok(took < 3000, `answer was cut off by the time limit (took ${took.toFixed(0)} ms)`);
  while (stub.open > 0) await new Promise((res) => setTimeout(res, 20));
  assert.equal(stub.aborted, 1, "the model request was cancelled");
  assert.equal(stub.calls[0].options.num_predict, 321);
  stub.server.close();
});

test("listens only on 127.0.0.1 by default", async () => {
  const stub = await startStub();
  const srv = await startServer(stub);
  assert.match(srv.log(), /on http:\/\/127\.0\.0\.1:/);
  stub.server.close();
});
