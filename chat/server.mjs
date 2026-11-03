// Partastar chat server: sits between the website's chat window and a local Ollama.
// No dependencies. Needs Node 18+.
//
//   node chat/server.mjs
//
// Settings (environment variables, all optional):
//   OLLAMA_URL     default http://127.0.0.1:11434
//   OLLAMA_MODEL   default gemma3:4b
//   PORT           default 8787
//   ALLOWED_ORIGINS  comma-separated; default https://partastar.solar,http://localhost:8000
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS ||
  "https://partastar.solar,https://www.partastar.solar,http://localhost:8000,http://127.0.0.1:8000")
  .split(",").map((s) => s.trim()).filter(Boolean);

const MAX_TURNS = 12;          // messages of history kept per request
const MAX_CHARS = 1000;        // per user message
const RATE_PER_MIN = 10;       // requests per visitor IP per minute

const LANG_NAMES = { mn: "Mongolian", en: "English", zh: "Simplified Chinese", ru: "Russian", kk: "Kazakh" };
const KNOWLEDGE = readFileSync(join(here, "knowledge-base.md"), "utf8");

function systemPrompt(lang) {
  const name = LANG_NAMES[lang] || "Mongolian";
  return [
    "You are the customer chat assistant on the Partastar Solar website.",
    `The visitor is reading the ${name} version of the site. Reply in ${name} unless they write in another language; then reply in their language.`,
    "Follow the assistant instructions in section 1 of the knowledge base below. Use only facts from it.",
    "Never give prices, stock or delivery dates. For orders and quotes, point to Facebook Messenger: https://m.me/61595385219266",
    "Keep answers short: a few sentences or a short list.",
    "",
    KNOWLEDGE
  ].join("\n");
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_PER_MIN;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < 60_000)) hits.delete(ip);
}, 60_000).unref();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req, max = 32_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const out = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);
  if (!out.length || out[out.length - 1].role !== "user" || !out[out.length - 1].content.trim()) return null;
  return out;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, "http://x");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      const tags = await r.json();
      const ok = (tags.models || []).some((m) => m.name === MODEL || m.model === MODEL);
      send(res, ok ? 200 : 503, { ok, model: MODEL, note: ok ? "ready" : `model not pulled: run "ollama pull ${MODEL}"` });
    } catch {
      send(res, 503, { ok: false, note: "Ollama is not reachable" });
    }
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/chat") { send(res, 404, { error: "not found" }); return; }

  const origin = req.headers.origin;
  if (origin && !ALLOWED.includes(origin)) { send(res, 403, { error: "origin not allowed" }); return; }

  // Behind Cloudflare Tunnel the visitor's IP arrives in this header.
  const ip = String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "?");
  if (limited(ip)) { send(res, 429, { error: "rate limited" }); return; }

  let body;
  try { body = JSON.parse(await readBody(req)); } catch { send(res, 400, { error: "bad request" }); return; }
  const messages = cleanMessages(body.messages);
  if (!messages) { send(res, 400, { error: "bad request" }); return; }
  const lang = LANG_NAMES[body.lang] ? body.lang : "mn";

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  let upstream;
  try {
    upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abort.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        options: { temperature: 0.3, num_ctx: 8192 },
        messages: [{ role: "system", content: systemPrompt(lang) }, ...messages]
      })
    });
  } catch {
    send(res, 502, { error: "model unavailable" });
    return;
  }
  if (!upstream.ok || !upstream.body) { send(res, 502, { error: "model unavailable" }); return; }

  // Stream plain text to the browser as the model writes it.
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for await (const chunk of upstream.body) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          if (j.message && j.message.content) res.write(j.message.content);
        } catch { /* ignore partial line */ }
      }
    }
  } catch { /* visitor closed the chat */ }
  res.end();
});

server.listen(PORT, () => {
  console.log(`Partastar chat server on http://localhost:${PORT}  (model ${MODEL}, Ollama ${OLLAMA_URL})`);
  console.log(`Check: http://localhost:${PORT}/health`);
});
