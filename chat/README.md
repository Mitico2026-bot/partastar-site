# Partastar AI chat (local Ollama)

How it fits together:

```
visitor on partastar.solar ──> chat window (chat/chat.js)
        ──> Cloudflare Tunnel (free public https address)
        ──> chat server on your computer (chat/server.mjs, port 8787)
        ──> Ollama on the same computer (port 11434)
```

The chat window stays hidden on the site until step 5 is done. If your computer
is off, visitors get a message pointing them to Messenger.

## 1. Pick and download a model

Open a terminal (Windows: PowerShell) and run one of these:

| Your computer | Command |
|---|---|
| No graphics card, or under 8 GB | `ollama pull gemma3:4b` |
| Graphics card with 8–12 GB | `ollama pull gemma3:12b` |
| Graphics card with 24 GB | `ollama pull gemma3:27b` |

Test it in Mongolian before going further:

```
ollama run gemma3:4b "Сайн байна уу. Нарны хавтан өвөл ажиллах уу? Монголоор товч хариулна уу."
```

If the Mongolian is poor, try a bigger model or `qwen3:8b`.

## 2. Install Node.js

Download the LTS version from https://nodejs.org and install it.

## 3. Start the chat server

Download this repository (GitHub → Code → Download ZIP) and open a terminal in
its folder.

Mac / Linux:
```
OLLAMA_MODEL=gemma3:4b node chat/server.mjs
```

Windows PowerShell:
```
$env:OLLAMA_MODEL="gemma3:4b"; node chat/server.mjs
```

Check it: open http://127.0.0.1:8787/health in your browser on the same
computer. It should say `"ok":true`, the model name, and `"ready"` (or what to
fix). Visitors who open `/health` through the public address only see
`{"ok":true}` or `{"ok":false}`.

## 4. Give it a public address (Cloudflare Tunnel, free)

Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Quick test (address changes every time you restart it):
```
cloudflared tunnel --url http://127.0.0.1:8787
```
It prints an address like `https://something-random.trycloudflare.com`.

For a permanent address such as `https://chat.partastar.solar`, the
partastar.solar domain must be on a free Cloudflare account; then create a
named tunnel (Cloudflare dashboard → Zero Trust → Networks → Tunnels) that
points `chat.partastar.solar` to `http://127.0.0.1:8787`.

Use `127.0.0.1`, not `localhost`: the chat server only listens on `127.0.0.1`, so
that only the tunnel on this computer can reach it, and on some computers
`localhost` means the IPv6 address `::1` instead.

## 5. Turn on the chat window

In `chat/chat.js`, set the address from step 4 (no slash at the end):

```js
var ENDPOINT = "https://chat.partastar.solar";
```

Publish the site as usual. The "Chat" button appears on every page in all
5 languages.

## Keeping it running

- The computer, Ollama, the chat server and the tunnel must all stay on.
- Each visitor IP is limited to 10 questions per minute; messages are capped
  at 1000 characters. The visitor's IP comes from the tunnel, so other
  computers on your network cannot pretend to be someone else.
- At most 2 answers are written at the same time (`MAX_CONCURRENT`). Extra
  visitors see "too many questions, please wait". Each answer is limited to
  512 tokens (`MAX_TOKENS`) and 90 seconds (`ANSWER_TIMEOUT_MS`), so a few
  visitors cannot keep the computer busy for everyone else.
- Only links to partastar.solar, m.me and facebook.com in an answer are
  clickable; any other web address the model writes is shown as plain text.
- Answers come only from `chat/knowledge-base.md`. When products change,
  update that file and restart the chat server.

## Settings

| Variable | Default |
|---|---|
| `OLLAMA_MODEL` | `gemma3:4b` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `PORT` | `8787` |
| `HOST` | `127.0.0.1` (keep it; anything else lets other computers reach the server directly) |
| `MAX_CONCURRENT` | `2` (raise it if your computer can answer more people at once) |
| `MAX_TOKENS` | `512` |
| `ANSWER_TIMEOUT_MS` | `90000` |
| `ALLOWED_ORIGINS` | `https://partastar.solar,https://www.partastar.solar` (add `http://127.0.0.1:8000` only while testing locally) |

To try the chat window on your computer before publishing:
1. Set `ENDPOINT` to `http://127.0.0.1:8787`, and start the server with
   `ALLOWED_ORIGINS=http://127.0.0.1:8000 node chat/server.mjs` so the local page may call it.
2. Build the site: `cd astro && npm ci && npm run build`.
3. Serve it: `python3 -m http.server 8000 -d astro/dist`, run from the repository folder.
4. Open http://127.0.0.1:8000.

## Tests

`node chat/server.test.mjs` starts the server against a stand-in for Ollama
and checks:
- that bad requests cannot crash it;
- that the rate limit can't be dodged with a fake `CF-Connecting-IP` header;
- that a flood stays cheap;
- that the limits on simultaneous answers, answer length and answer time
  work;
- that only the site's own origins are allowed by default;
- that `/health` shows details only to someone at this computer;
- that a visitor who stops reading pauses the answer instead of filling memory.
