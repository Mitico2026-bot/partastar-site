// Copies the existing static assets from the original site into astro/public/ (git-ignored),
// so there is a single copy of images/CSS/JS in the repository during the migration.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "..");
const PUB = join(here, "..", "public");
rmSync(PUB, { recursive: true, force: true });
mkdirSync(join(PUB, "chat"), { recursive: true });
for (const f of ["img", "style.css", "app.js", "favicon.ico", "robots.txt", "llms.txt"]) cpSync(join(SRC, f), join(PUB, f), { recursive: true });
cpSync(join(SRC, "chat", "chat.js"), join(PUB, "chat", "chat.js")); // only the widget; never the server or knowledge base
console.log("public/ synced");
