// Compares every generated page in dist/ against the hand-written original site.
// Ignores formatting-only whitespace, attribute order and HTML entity spelling;
// compares JSON-LD by parsed value. Exits 1 on any difference.
//
//   npm run compare                      (after npm run build)
//   COMPARE_REF=<git-ref> npm run compare
//
// The original HTML was removed from the repository root when the deploy switched to this build.
// Originals are read from git at ORIGINALS_REF (e6a2a40fcdb3, the last commit that had them), so this
// stays a regression check for refactors. It is expected to report differences once content is
// edited on purpose; at that point move ORIGINALS_REF forward or stop running it.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..", "..");
const ORIGINALS_REF = process.env.COMPARE_REF || "e6a2a40fcdb3";
const original = (rel) => existsSync(join(REPO, rel)) && !process.env.COMPARE_REF
  ? readFileSync(join(REPO, rel), "utf8")
  : execFileSync("git", ["-C", REPO, "show", `${ORIGINALS_REF}:${rel}`], { encoding: "utf8", maxBuffer: 64 << 20 });
const DIST = join(here, "..", "dist");
const site = JSON.parse(readFileSync(join(here, "..", "src", "data", "site.json"), "utf8"));

const ws = (s) => s.replace(/\s+/g, " ");
function canon(node) {
  if (node.nodeType === 3) { const t = ws(node.text); return t.trim() ? t : null; }
  if (node.nodeType !== 1) return null;
  const tag = node.tagName ? node.tagName.toLowerCase() : "#root";
  const attrs = Object.entries(node.attributes || {}).sort(([a], [b]) => a.localeCompare(b));
  if (tag === "script") {
    const body = node.text.trim();
    // JSON payloads are compared by value: whitespace and key spacing inside JSON is not significant.
    const v = node.getAttribute("type") === "application/ld+json" ? JSON.stringify(JSON.parse(body))
      : body.startsWith("window.I18N=") ? "window.I18N=" + JSON.stringify(JSON.parse(body.slice(12).replace(/;\s*$/, ""))) + ";"
      : body;
    return { tag, attrs, kids: [v] };
  }
  const kids = node.childNodes.map(canon).filter((k) => k !== null);
  // merge adjacent text and trim at element boundaries, so "a <b>" vs "a<b>" formatting noise is ignored
  const merged = [];
  for (const k of kids) typeof k === "string" && typeof merged.at(-1) === "string" ? (merged[merged.length - 1] += k) : merged.push(k);
  return { tag, attrs, kids: merged.map((k) => (typeof k === "string" ? k.trim() : k)).filter((k) => k !== "") };
}
function diff(a, b, path) {
  if (typeof a === "string" || typeof b === "string") return a === b ? null : `${path}: text ${JSON.stringify(a)?.slice(0, 120)} != ${JSON.stringify(b)?.slice(0, 120)}`;
  if (a.tag !== b.tag) return `${path}: <${a.tag}> != <${b.tag}>`;
  const sa = JSON.stringify(a.attrs), sb = JSON.stringify(b.attrs);
  if (sa !== sb) return `${path}<${a.tag}>: attrs ${sa.slice(0, 300)} != ${sb.slice(0, 300)}`;
  for (let i = 0; i < Math.max(a.kids.length, b.kids.length); i++) {
    if (a.kids[i] === undefined || b.kids[i] === undefined) return `${path}<${a.tag}>: child count ${a.kids.length} != ${b.kids.length} (first extra: ${JSON.stringify(a.kids[i] ?? b.kids[i]).slice(0, 160)})`;
    const d = diff(a.kids[i], b.kids[i], `${path}<${a.tag}>[${i}]`);
    if (d) return d;
  }
  return null;
}
const canonOf = (html) => canon(parse(html.replace(/^<!doctype html>/i, ""), { comment: false }));

let ok = 0, bad = 0;
const targets = [...site.langs.flatMap((l) => site.pages.map(({ slug }) => (l === "mn" ? "" : l + "/") + slug + ".html")), "404.html"];
for (const rel of targets) {
  if (!existsSync(join(DIST, rel))) { console.log(`MISSING ${rel}`); bad++; continue; }
  const d = diff(canonOf(original(rel)), canonOf(readFileSync(join(DIST, rel), "utf8")), "");
  if (d) { console.log(`DIFF    ${rel}\n        ${d}`); bad++; } else ok++;
}
// sitemap.xml: same set of <url> lines (order is not significant to search engines).
const lines = (text) => text.split("\n").map((x) => x.trim()).filter((x) => x.startsWith("<url>")).sort();
const sa = lines(original("sitemap.xml")), sb = existsSync(join(DIST, "sitemap.xml")) ? lines(readFileSync(join(DIST, "sitemap.xml"), "utf8")) : [];
if (JSON.stringify(sa) === JSON.stringify(sb)) ok++; else { bad++; console.log(`DIFF    sitemap.xml: ${sa.length} vs ${sb.length} URLs, or different entries`); }
console.log(`\n${ok} identical, ${bad} different (original vs generated; ${targets.length} pages + sitemap.xml)`);
process.exit(bad ? 1 : 0);
