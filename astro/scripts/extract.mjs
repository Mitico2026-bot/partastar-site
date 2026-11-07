// One-off extractor: reads the hand-written HTML category pages (all 5 languages)
// and writes structured JSON into src/data/. Re-runnable; the original pages are never modified.
//
//   npm run extract
//
// Output:
//   src/data/site.json                 shared header/footer/UI strings per language
//   src/data/categories/<slug>.json    one file per category, all 5 languages side by side
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const here = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(here, "..", ".."); // the original static site
const DATA = join(here, "..", "src", "data");
const LANGS = ["mn", "en", "zh", "ru", "kk"];
const dirOf = (l) => (l === "mn" ? "" : l + "/");
const load = (l, slug) => parse(readFileSync(join(SITE_ROOT, dirOf(l) + slug + ".html"), "utf8"), { comment: false });
const txt = (n) => (n ? n.text.trim() : null);
const must = (v, what) => { if (v == null) throw new Error("missing " + what); return v; };

// Category list comes from the Mongolian page's category nav.
const cats = load("mn", "solar-panels").querySelectorAll("nav.cats a").map((a) => a.getAttribute("href").replace(/\.html$/, ""));

// ---------- shared per-language strings ----------
const site = { langs: LANGS, categories: cats, i18n: {} };
for (const l of LANGS) {
  const d = load(l, cats[0]);
  const meta = (sel) => d.querySelector(sel)?.getAttribute("content");
  const order = d.querySelector("nav.top-links a.btn");
  const mbar = d.querySelector(".mbar a.btn");
  const foot = d.querySelector("footer.site-foot");
  const fcols = foot.querySelectorAll(".cols > div");
  const contact = fcols[2].querySelectorAll("a");
  const i18nScript = d.querySelectorAll("script").map((s) => s.text).find((t) => t.startsWith("window.I18N="));
  site[l] = {
    htmlLang: d.querySelector("html").getAttribute("lang"),
    ogLocale: meta('meta[property="og:locale"]'),
    langName: txt(d.querySelector(`.lang-menu a[aria-current="true"]`)),
    skip: txt(d.querySelector("a.skip")),
    brandAria: d.querySelector("a.brand").getAttribute("aria-label"),
    topNavAria: d.querySelector("nav.top-links").getAttribute("aria-label"),
    greenLoan: txt(d.querySelector('nav.top-links a[href="green-loan.html"]')),
    about: txt(d.querySelector('nav.top-links a[href="about.html"]')),
    order: { text: txt(order), copy: order.getAttribute("data-copy") },
    catsAria: d.querySelector("nav.cats").getAttribute("aria-label"),
    catLabels: Object.fromEntries(d.querySelectorAll("nav.cats a").map((a) => [a.getAttribute("href").replace(/\.html$/, ""), txt(a)])),
    crumbsHome: txt(d.querySelector(".page-head .crumbs a")),
    footer: {
      tagline: txt(fcols[0].querySelector("p")),
      productsTitle: txt(fcols[1].querySelector("h3")),
      contactTitle: txt(fcols[2].querySelector("h3")),
      messenger: txt(contact[0]),
      facebookPage: txt(contact[1]),
      greenLoan: txt(contact[2]),
      about: txt(contact[3]),
      legal: txt(foot.querySelector("p.legal"))
    },
    mbar: { text: txt(mbar), copy: mbar.getAttribute("data-copy") },
    lineButton: null,
    copyTemplate: null
  };
  if (i18nScript) site.i18n[l] = JSON.parse(i18nScript.slice("window.I18N=".length).replace(/;\s*$/, ""));
}
for (const l of LANGS) site[l].langNames = Object.fromEntries(LANGS.map((t) => [t, site[t].langName]));

// ---------- per-category content ----------
let structured = 0, raw = 0, explicitCopy = 0;
mkdirSync(join(DATA, "categories"), { recursive: true });
for (const slug of cats) {
  const out = { slug, scene: null, langs: {} };
  for (const l of LANGS) {
    const d = load(l, slug);
    const meta = (sel) => d.querySelector(sel)?.getAttribute("content");
    const head = d.querySelector("main > section.page-head");
    const i18nScript = d.querySelectorAll("script").map((s) => s.text).find((t) => t.startsWith("window.I18N="));
    if (i18nScript && JSON.stringify(JSON.parse(i18nScript.slice(12).replace(/;\s*$/, ""))) !== JSON.stringify(site.i18n[l]))
      throw new Error(`${l}/${slug}: page-specific I18N dictionary not supported yet`);
    out.scene = head.querySelector(".s3d")?.getAttribute("data-scene") ?? null;
    const page = {
      title: txt(d.querySelector("title")),
      description: must(meta('meta[name="description"]'), "description"),
      ogImage: meta('meta[property="og:image"]').replace("https://partastar.solar/", ""),
      h1: txt(head.querySelector("h1")),
      crumb: head.querySelector(".crumbs").text.split("/").slice(1).join("/").trim(),
      introHtml: head.querySelector(".wrap > p:not(.crumbs)").innerHTML,
      sections: []
    };
    for (const sec of d.querySelector("main").childNodes.filter((n) => n.nodeType === 1 && n !== head)) {
      const line = sec.tagName === "SECTION" && sec.classList.contains("line") ? toLine(sec, l) : null;
      if (line) { page.sections.push(line); structured++; explicitCopy += line.blocks.filter((b) => b.copy).length; }
      else { page.sections.push({ type: "raw", html: sec.outerHTML, product: productMeta(sec) }); raw++; }
    }
    out.langs[l] = page;
  }
  writeFileSync(join(DATA, "categories", slug + ".json"), JSON.stringify(out, null, 2) + "\n");
}
writeFileSync(join(DATA, "site.json"), JSON.stringify(site, null, 2) + "\n");
console.log(`categories=${cats.length} langs=${LANGS.length} structured lines=${structured} raw sections=${raw} lines with non-template copy text=${explicitCopy}`);

// A product line is an ordered list of blocks inside .wrap:
//   top      picture column + header column (h2, ordered parts, one Messenger button)
//   h2/lead  compact lines without a picture
//   button   a standalone Messenger button
//   table / tblTitle / note
// Anything else makes the whole section fall back to raw HTML.
function toLine(sec, l) {
  const el = (n) => n.childNodes.filter((c) => c.nodeType === 1);
  const is = (n, tag, cls) => n.tagName.toLowerCase() === tag && (cls === undefined ? n.classList.value.length === 0 : n.classList.value.join(" ") === cls);
  // text-only element whose only attributes are class (and optionally style, which is kept)
  const plain = (n, allowStyle) => !el(n).length && Object.keys(n.attributes).every((a) => a === "class" || (allowStyle && a === "style"));
  const styled = (n) => (n.getAttribute("style") ? { style: n.getAttribute("style") } : {});
  const s = site[l];
  let name = null;
  const button = (div) => {
    const b = el(div);
    if (b.length !== 1) return null;
    const btn = b[0], copy = btn.getAttribute("data-copy");
    s.lineButton ??= txt(btn);
    if (txt(btn) !== s.lineButton || btn.getAttribute("href") !== "https://m.me/61595385219266" || btn.getAttribute("class") !== "btn") return null;
    if (!s.copyTemplate && name && copy.includes(name)) s.copyTemplate = copy.replace(name, "{name}");
    const fromTemplate = s.copyTemplate && name && s.copyTemplate.replace("{name}", name) === copy;
    return fromTemplate ? {} : { copy };
  };
  const parts = (nodes) => {
    const out = [];
    for (const k of nodes) {
      if (is(k, "p", "lead") && plain(k, true)) out.push({ k: "lead", text: txt(k), ...styled(k) });
      else if (is(k, "p", "chip-title") && plain(k)) out.push({ k: "chipTitle", text: txt(k) });
      else if (is(k, "ul", "chips") && k.getAttribute("style") === "margin-top:8px" && el(k).every((li) => li.tagName === "LI" && plain(li))) out.push({ k: "chips", items: el(k).map(txt) });
      else if (is(k, "ul", "prose") && k.getAttribute("style") === "margin-top:14px;padding-left:1.2rem" && el(k).every((li) => li.tagName === "LI")) out.push({ k: "prose", items: el(k).map((li) => li.innerHTML) });
      else if (is(k, "dl", "facts-dl") && el(k).every((dv) => is(dv, "div") && el(dv).length === 2 && el(dv)[0].tagName === "DT" && el(dv)[1].tagName === "DD" && plain(el(dv)[0])))
        out.push({ k: "facts", items: el(k).map((dv) => [txt(el(dv)[0]), el(dv)[1].innerHTML]) });
      else return null;
    }
    return out;
  };
  const blocks = [];
  for (const k of el(sec.querySelector(".wrap"))) {
    if (is(k, "div", "line-top")) {
      const [picDiv, body, ...extra] = el(k);
      if (extra.length || !picDiv || !body || !is(body, "div")) return null;
      const picCls = picDiv.classList.value.join(" ");
      if (!["pic", "pic two"].includes(picCls) || !el(picDiv).length) return null;
      const imgs = [];
      for (const img of el(picDiv)) {
        if (img.tagName !== "IMG" || img.getAttribute("loading") !== "lazy" || img.getAttribute("decoding") !== "async") return null;
        const extraAttrs = Object.keys(img.attributes).filter((a) => !["src", "alt", "width", "height", "loading", "decoding", "class"].includes(a));
        if (extraAttrs.length) return null;
        imgs.push({ src: img.getAttribute("src").replace(/^(\.\.\/)?/, ""), alt: img.getAttribute("alt"), w: +img.getAttribute("width"), h: +img.getAttribute("height"), ...(img.getAttribute("class") ? { cls: img.getAttribute("class") } : {}) });
      }
      const kids = el(body);
      if (kids.length < 2 || !is(kids[0], "h2") || !plain(kids[0]) || !is(kids.at(-1), "div", "btns")) return null;
      name ??= txt(kids[0]);
      const p = parts(kids.slice(1, -1)), b = button(kids.at(-1));
      if (!p || !b) return null;
      blocks.push({ k: "top", two: picCls === "pic two", imgs, h2: txt(kids[0]), parts: p, ...b });
    } else if (is(k, "h2") && plain(k)) { name ??= txt(k); blocks.push({ k: "h2", text: txt(k) }); }
    else if (is(k, "p", "lead") && plain(k, true)) blocks.push({ k: "lead", text: txt(k), ...styled(k) });
    else if (is(k, "div", "btns")) { const b = button(k); if (!b) return null; blocks.push({ k: "button", ...b }); }
    else if (is(k, "div", "tbl-wrap") && k.getAttribute("tabindex") === "0" && k.getAttribute("role") === "region" && el(k).length === 1 && is(el(k)[0], "table", "spec"))
      blocks.push({ k: "table", label: k.getAttribute("aria-label"), table: tableData(el(k)[0]) });
    else if (is(k, "p", "tbl-title") && plain(k)) blocks.push({ k: "tblTitle", text: txt(k) });
    else if (is(k, "p", "note")) blocks.push({ k: "note", html: k.innerHTML });
    else return null;
  }
  if (!blocks.length || !name) return null;
  const id = sec.getAttribute("id");
  if (Object.keys(sec.attributes).some((a) => !["class", "id"].includes(a))) return null;
  return { type: "line", ...(id ? { id } : {}), name, blocks };
}

// Tables are kept cell-by-cell: [tag, html, attrs] so colspans, "merged" cells and scopes round-trip.
function tableData(t) {
  const rows = (sel) => t.querySelectorAll(sel).map((tr) => tr.childNodes.filter((c) => c.nodeType === 1).map((c) => {
    const a = { ...c.attributes };
    return Object.keys(a).length ? [c.tagName.toLowerCase(), c.innerHTML, a] : [c.tagName.toLowerCase(), c.innerHTML];
  }));
  const unknown = t.childNodes.filter((c) => c.nodeType === 1 && !["THEAD", "TBODY"].includes(c.tagName));
  if (unknown.length) throw new Error("unsupported table child " + unknown[0].tagName);
  return { head: rows("thead > tr"), body: rows("tbody > tr") };
}

// Name/description/image for JSON-LD when a section is kept as raw HTML
// (same rule as src/lib/site.ts productOf: a product needs a picture; description = lead in .line-top).
function productMeta(sec) {
  const h2 = sec.querySelector("h2"), img = sec.querySelector(".pic img"), lead = sec.querySelector(".line-top p.lead");
  if (!h2 || !img) return null;
  return { id: sec.getAttribute("id") ?? null, name: txt(h2), lead: txt(lead), img: img ? img.getAttribute("src").replace(/^(\.\.\/)?/, "") : null };
}
