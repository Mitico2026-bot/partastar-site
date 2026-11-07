#!/usr/bin/env node
// Drives the Partastar site in headless Chromium (Playwright). Run from the repository root.
//
//   node .claude/skills/run-partastar-site/driver.mjs flow  [--base URL] [--out DIR]
//   node .claude/skills/run-partastar-site/driver.mjs shot  PATH... [--base URL] [--out DIR]
//   node .claude/skills/run-partastar-site/driver.mjs chat  [--base URL] [--out DIR] [--ask TEXT]
//
// flow  home page -> calculator (5.12 kWh) -> language switch to English -> Solar panels
//       -> "Ask on Facebook" button (clipboard + toast). Prints what it saw, saves screenshots.
// shot  screenshots of the given paths, e.g. / en/solar-panels.html kk/index.html
// chat  starts the real chat/server.mjs against a stub Ollama, turns the hidden chat widget on
//       for this browser only (ENDPOINT is patched in the response, not in the file), sends one
//       question and prints the streamed answer.
//
// --base defaults to http://localhost:4321 (the Astro dev server). Screenshots go to --out
// (default: $TMPDIR/partastar-run). Exits 1 on any page error or failed check.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright"); // resolved through NODE_PATH; ESM imports would ignore it

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("--") ? args.shift() : "flow";
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const BASE = opt("--base", "http://localhost:4321").replace(/\/$/, "");
const OUT = resolve(opt("--out", join(tmpdir(), "partastar-run")));
const ASK = opt("--ask", "Which battery suits a small house?");
mkdirSync(OUT, { recursive: true });

let failed = false;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed = true; };

async function reachable(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

async function browser() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  // Google Fonts needs internet; Vercel Analytics only exists on Vercel. Both would only add console noise.
  await ctx.route(/fonts\.g(oogleapis|static)\.com|\/_vercel\//, (r) => r.abort());
  const errors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  return { b, ctx, errors };
}
const shotPath = (name) => join(OUT, name.replace(/[^a-z0-9.-]+/gi, "_") + ".png");

async function flow() {
  const { b, ctx, errors } = await browser();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check((await page.locator(".hero h1").count()) === 1, `home: ${await page.title()}`);
  await page.screenshot({ path: shotPath("1-home") });

  await page.locator("#runtime").scrollIntoViewIfNeeded();
  const before = (await page.locator(".loads li .hours").first().innerText()).trim();
  await page.click('label[for="rt-2"]'); // 5.12 kWh
  const after = (await page.locator(".loads li .hours").first().innerText()).trim();
  const models = await page.locator(".models a").allInnerTexts();
  check(before !== after && models.length > 0, `calculator: TV ${before} -> ${after} at ${await page.textContent(".kwh")} kWh; models ${models.join(", ")}`);
  await page.locator("#runtime").screenshot({ path: shotPath("2-calculator") });

  await page.click("details.lang summary");
  await page.click('.lang-menu a[hreflang="en"]');
  await page.waitForLoadState("networkidle");
  check(page.url().endsWith("/en/index.html"), `language switch -> ${page.url()}: ${(await page.textContent(".hero h1")).trim()}`);

  await page.click('nav.cats a[href="solar-panels.html"]');
  await page.waitForLoadState("networkidle");
  const products = await page.locator("section.line h2").allInnerTexts();
  check(products.length > 0, `category -> ${page.url()}: ${products.join(" | ")}`);
  await page.screenshot({ path: shotPath("3-en-solar-panels") });

  const popup = ctx.waitForEvent("page", { timeout: 3000 }).catch(() => null);
  await page.locator("section.line a[data-copy]").first().click();
  await page.waitForSelector(".toast.show", { timeout: 3000 });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const tab = await popup;
  check(clip.length > 0, `order button: clipboard "${clip}"; toast "${(await page.textContent(".toast")).trim()}"; new tab ${tab ? tab.url() : "(none)"}`);
  await page.screenshot({ path: shotPath("4-order-toast") });

  check(errors.length === 0, `page errors: ${errors.length ? errors.join("; ") : "none"}`);
  await b.close();
}

async function shot(paths) {
  if (!paths.length) paths = ["/"];
  const { b, ctx, errors } = await browser();
  const page = await ctx.newPage();
  for (const p of paths) {
    const url = `${BASE}/${p.replace(/^\//, "")}`;
    const res = await page.goto(url, { waitUntil: "networkidle" });
    const file = shotPath(p.replace(/^\/+/, "") || "index");
    await page.screenshot({ path: file, fullPage: true });
    check(res && res.ok(), `${url} -> ${res && res.status()} -> ${file}`);
  }
  check(errors.length === 0, `page errors: ${errors.length ? errors.join("; ") : "none"}`);
  await b.close();
}

async function chat() {
  // Stub Ollama: lists the model and streams a fixed answer, the way /api/chat does.
  const answer = ["Hello! ", "For a small house, a 5.12 kWh stackable battery is a common start. ", "Ask us on Messenger: https://m.me/61595385219266"];
  const stub = http.createServer((req, res) => {
    if (req.url === "/api/tags") { res.end(JSON.stringify({ models: [{ name: "stub:1" }] })); return; }
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      for (const t of answer) res.write(JSON.stringify({ message: { content: t } }) + "\n");
      res.end(JSON.stringify({ done: true }) + "\n");
    });
  });
  await new Promise((r) => stub.listen(0, "127.0.0.1", r));
  const chatPort = 18000 + Math.floor(Math.random() * 1000);
  const origin = new URL(BASE).origin;
  const server = spawn(process.execPath, ["chat/server.mjs"], {
    env: { PATH: process.env.PATH, PORT: String(chatPort), OLLAMA_URL: `http://127.0.0.1:${stub.address().port}`, OLLAMA_MODEL: "stub:1", ALLOWED_ORIGINS: origin },
    stdio: ["ignore", "pipe", "inherit"]
  });
  await new Promise((r, j) => { server.stdout.once("data", r); server.once("exit", (c) => j(new Error("chat server exited " + c))); });
  const endpoint = `http://127.0.0.1:${chatPort}`;
  check(await reachable(`${endpoint}/health`), `chat server ${endpoint}/health (stub Ollama)`);

  const { b, ctx, errors } = await browser();
  // Turn the widget on for this browser only: ENDPOINT is "" in chat/chat.js, so patch the response.
  await ctx.route(/\/chat\/chat\.js/, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace('var ENDPOINT = "";', `var ENDPOINT = "${endpoint}";`) });
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/index.html`, { waitUntil: "networkidle" });
  await page.click(".pc-btn");
  await page.fill(".pc-in", ASK);
  await page.press(".pc-in", "Enter");
  const reply = page.locator(".pc-m.a").nth(1);
  await reply.filter({ hasText: "Messenger" }).waitFor({ timeout: 10000 });
  const text = (await reply.innerText()).trim();
  const links = await reply.locator("a").evaluateAll((as) => as.map((a) => a.href));
  check(text.startsWith("Hello!"), `chat answer: "${text}"`);
  check(links.length === 1 && links[0].startsWith("https://m.me/"), `clickable links in answer: ${links.join(", ") || "(none)"}`);
  await page.screenshot({ path: shotPath("chat") });
  check(errors.length === 0, `page errors: ${errors.length ? errors.join("; ") : "none"}`);
  await b.close();
  server.kill();
  stub.close();
}

if (!(await reachable(`${BASE}/`))) {
  console.error(`Nothing is serving ${BASE}/ - start the site first (see SKILL.md: cd astro && npm run dev).`);
  process.exit(2);
}
if (cmd === "flow") await flow();
else if (cmd === "shot") await shot(args);
else if (cmd === "chat") await chat();
else { console.error(`unknown command "${cmd}" (flow | shot | chat)`); process.exit(2); }
console.log(`screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
