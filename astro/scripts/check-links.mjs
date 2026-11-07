// Checks the built site in dist/: every internal link and resource on every page must resolve.
//   - href/src pointing inside the site must name a file that exists in dist/
//     (directory links like /en/ resolve to index.html; ?query is ignored);
//   - #fragments must match an id on the target page (same-page and cross-page).
// External URLs (https:, mailto:, tel:) and /_vercel/ (served by Vercel itself) are not checked.
// Exits 1 listing every broken reference.
//
//   npm run build && npm run check:links
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const pages = walk(DIST).filter((f) => f.endsWith(".html"));
const ids = new Map(); // file -> Set of ids
const doc = (file) => {
  if (!ids.has(file)) ids.set(file, new Set(parse(readFileSync(file, "utf8")).querySelectorAll("[id]").map((e) => e.getAttribute("id"))));
  return ids.get(file);
};

const broken = [];
let checked = 0;
for (const page of pages) {
  const root = parse(readFileSync(page, "utf8"));
  const refs = [
    ...root.querySelectorAll("[href]").map((e) => e.getAttribute("href")),
    ...root.querySelectorAll("[src]").map((e) => e.getAttribute("src"))
  ];
  for (const ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(ref) || ref.startsWith("//") || ref.startsWith("/_vercel/")) continue;
    checked++;
    const [pathPart, frag] = ref.split("#");
    const path = pathPart.split("?")[0];
    let target = path === "" ? page : path.startsWith("/") ? join(DIST, path) : resolve(dirname(page), path);
    if (!target.startsWith(DIST + sep) && target !== DIST) { broken.push(`${relative(DIST, page)}: ${ref} (points outside the site)`); continue; }
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!existsSync(target)) { broken.push(`${relative(DIST, page)}: ${ref} (no such file)`); continue; }
    if (frag && target.endsWith(".html") && !doc(target).has(decodeURIComponent(frag))) broken.push(`${relative(DIST, page)}: ${ref} (no id "${frag}" on ${relative(DIST, target)})`);
  }
}
for (const b of broken) console.log("BROKEN  " + b);
console.log(`\n${pages.length} pages, ${checked} internal links/resources checked, ${broken.length} broken`);
process.exit(broken.length ? 1 : 0);
