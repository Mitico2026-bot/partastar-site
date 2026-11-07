---
name: run-partastar-site
description: Build, run, preview and drive the Partastar Solar website (Astro static site in astro/) and its optional AI chat widget/server (chat/). Use when asked to start or run the site, preview a page, take a screenshot, click through it in a browser, try the chat widget, check that the build still matches, or run the site/chat tests.
---

The site is a static Astro build in `astro/`, generated from `astro/src/data/`. The optional AI chat lives in `chat/`. To drive it, start the dev server, then run `.claude/skills/run-partastar-site/driver.mjs`, a headless-Chromium Playwright script that clicks through the site and the chat widget and saves screenshots. `chromium-cli` is not installed in these containers. All paths below are relative to the repository root.

## Prerequisites

- **Node 22.23.4 or newer.** Astro 7 refuses older versions, and the Vercel project must use Node 22.x. These containers have `/opt/node22`.
- **Playwright with Chromium**, found through `NODE_PATH`. It was preinstalled here. Don't run `playwright install`.
- **Nothing else.** No apt packages, no Ollama, no internet: the chat uses a stub Ollama.

## Setup

```bash
cd astro && npm ci
```

## Run (agent path)

```bash
cd astro && npm run dev            # returns after ~2 s; the server keeps running in the background on :4321
timeout 30 bash -c 'until curl -sf http://localhost:4321/ >/dev/null; do sleep 1; done'
cd ..

node .claude/skills/run-partastar-site/driver.mjs flow
node .claude/skills/run-partastar-site/driver.mjs shot / kk/about.html zh/ev-chargers.html
node .claude/skills/run-partastar-site/driver.mjs chat

cd astro && npx astro dev stop     # status: npx astro dev status   logs: npx astro dev logs
```

Each command prints one `ok` or `FAIL` line per check and exits 1 on any failure. If nothing is serving the site, it exits 2.

| Command | What it does |
|---|---|
| `flow` | Opens the Mongolian home page and sets the calculator to 5.12 kWh (TV runtime 60 h → 31 h). Switches the language to English, opens Solar panels from the category bar, and clicks the first "Ask on Facebook" button. Then checks the clipboard text and the toast. |
| `shot PATH...` | Full-page screenshot of each path. Mongolian is at the root (`/`, `solar-panels.html`); other languages are under `en/`, `zh/`, `ru/` and `kk/`. |
| `chat [--ask TEXT]` | Starts the real `chat/server.mjs` against a stub Ollama on loopback. Turns the chat widget on for this browser only, sends one question, and checks the streamed answer. It also checks that only the `m.me` link in the answer is clickable. |

Screenshots are written to `--out` (default `$TMPDIR/partastar-run`) at 2× scale. Look at them.

### Production build instead of dev

`--base` points the driver at any URL. To drive the exact files Vercel deploys:

```bash
cd astro && npm run build          # writes astro/dist (66 pages + sitemap.xml)
python3 -m http.server 4322 --bind 127.0.0.1 -d dist &
cd .. && node .claude/skills/run-partastar-site/driver.mjs flow --base http://127.0.0.1:4322
lsof -ti:4322 -sTCP:LISTEN | xargs -r kill
```

## Test

```bash
cd astro && npm run check          # build + compare every page with the original hand-written pages (from git)
npm run check:links                # every internal href/src on every built page resolves, including #fragments
cd .. && node chat/server.test.mjs # 11 chat-server tests against a stub Ollama; summary lines: "# pass 11", "# fail 0"
```

CI (`.github/workflows/ci.yml`) runs these checks on every pull request. It also runs the driver's `flow` and `chat` checks against the served production build, and uploads the screenshots as an artifact. In CI the comparison is informational only.

`npm run compare` diffs `astro/dist` against the original pages at git commit `e6a2a40fcdb3`. A deliberate content edit shows up as a `DIFF` for that page. That's expected; it's a regression check for template changes.

## Gotchas

- **`npm run dev` doesn't block.** In a non-interactive shell, Astro 7 backgrounds the dev server (`astro dev --json`) and returns. Don't `&` it, and don't wait on it. Stop it with `npx astro dev stop`, run from `astro/`.
- **The dev server can disappear between agent turns.** `astro dev status` once reported "No dev server is running" when nothing had stopped it. Poll the port before driving, and restart if needed.
- **Asset changes need a restart.** `npm run dev` and `npm run build` first copy `img/`, `style.css`, `app.js` and `chat/chat.js` from the repo root into `astro/public/` (git-ignored). After editing one of those, run `astro dev stop` and then `npm run dev` again.
- **The chat widget is off on the real site** (`ENDPOINT = ""` in `chat/chat.js`). `driver.mjs chat` patches `ENDPOINT` in the browser's copy of the response only. Never edit the file to test. It also starts the chat server with `ALLOWED_ORIGINS` set to the `--base` origin, because the server's default allows only partastar.solar.
- **"Failed to load resource: net::ERR_FAILED" console lines have no URL.** They are Google Fonts, which needs internet, and `/_vercel/insights/script.js`, which exists only on Vercel. The driver blocks both. Don't chase them.
- **Order buttons open a Messenger tab, which lands on `chrome-error://`** because there's no internet here. Check the clipboard text and the toast instead.
- **Dev screenshots show Astro's dev toolbar** at the bottom. Production builds don't have it.
- **Pixel comparisons are timing-sensitive.** Lazy-loaded photos and the photo-depth effect in `app.js` make the original site differ from itself between runs. Use `npm run compare` for equality, and screenshots for looking.
- **Playwright and ES modules:** Playwright is found through `NODE_PATH`, which ES module `import` ignores. The driver loads it with `createRequire`. Keep that if you change the driver.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Nothing is serving http://localhost:4321/` (exit 2) | Start the dev server: `cd astro && npm run dev`. Or pass `--base` with the URL you're serving. |
| `Cannot find module 'playwright'` | You imported it with ES `import`. Use `createRequire(import.meta.url)("playwright")`, as the driver does. |
| `npm run extract` → `ENOENT ... solar-panels.html` | That was an old extractor. The current one reads the originals from git. Don't re-run it after hand-editing `astro/src/data`, because it overwrites the data. |
