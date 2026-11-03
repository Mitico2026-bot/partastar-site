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

Check it: open http://localhost:8787/health in your browser. It should say
`"ok":true`.

## 4. Give it a public address (Cloudflare Tunnel, free)

Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Quick test (address changes every time you restart it):
```
cloudflared tunnel --url http://localhost:8787
```
It prints an address like `https://something-random.trycloudflare.com`.

For a permanent address such as `https://chat.partastar.solar`, the
partastar.solar domain must be on a free Cloudflare account; then create a
named tunnel (Cloudflare dashboard → Zero Trust → Networks → Tunnels) that
points `chat.partastar.solar` to `http://localhost:8787`.

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
  at 1000 characters.
- Answers come only from `chat/knowledge-base.md`. When products change,
  update that file and restart the chat server.

## Settings

| Variable | Default |
|---|---|
| `OLLAMA_MODEL` | `gemma3:4b` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `PORT` | `8787` |
| `ALLOWED_ORIGINS` | `https://partastar.solar,https://www.partastar.solar,http://localhost:8000,http://127.0.0.1:8000` |

To try the chat window on your computer before publishing: set `ENDPOINT` to
`http://localhost:8787`, run `python3 -m http.server 8000` in the repository
folder, and open http://localhost:8000.
