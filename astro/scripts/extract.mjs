// One-off extractor: reads the hand-written HTML pages (all 5 languages)
// and writes structured JSON into src/data/. Re-runnable; the original pages are never modified.
//
//   npm run extract
//
// Output:
//   src/data/site.json            shared header/footer/UI strings per language
//   src/data/pages/<slug>.json    one file per page, all 5 languages side by side
//                                 kind: "category" (product list) | "content" (about, green-loan) | "home"
// 404.html is not extracted: it is a small Mongolian-only page ported by hand (src/pages/404.astro).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const here = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(here, "..", ".."); // the original static site
const DATA = join(here, "..", "src", "data");
const LANGS = ["mn", "en", "zh", "ru", "kk"];
const dirOf = (l) => (l === "mn" ? "" : l + "/");
// The original pages were removed from the repository root when the deploy switched to this build;
// they are read from git at ORIGINALS_REF (the same reference scripts/compare.mjs uses).
// Re-running this overwrites src/data/, so only do it before anyone edits the data files by hand.
const ORIGINALS_REF = process.env.EXTRACT_REF || "e6a2a40fcdb3";
const original = (rel) => existsSync(join(SITE_ROOT, rel))
  ? readFileSync(join(SITE_ROOT, rel), "utf8")
  : execFileSync("git", ["-C", SITE_ROOT, "show", `${ORIGINALS_REF}:${rel}`], { encoding: "utf8", maxBuffer: 64 << 20 });
const load = (l, slug) => parse(original(dirOf(l) + slug + ".html"), { comment: false });
const txt = (n) => (n ? n.text.trim() : null);
const must = (v, what) => { if (v == null) throw new Error("missing " + what); return v; };

// ---------- typed one-off sections (home page, about, green-loan, notes, quick links) ----------
const GALLERY_STYLE = "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:20px";
const kids = (n) => n.childNodes.filter((c) => c.nodeType === 1);
const sig = (n) => n.tagName.toLowerCase() + (n.getAttribute("class") ? "." + n.getAttribute("class").trim().split(/\s+/).join(".") : "");
const shape = (n) => kids(n).map(sig).join(" ");
const html = (n) => n.innerHTML.trim();
function imgData(img) {
  const a = img.attributes, out = { src: a.src.replace(/^(\.\.\/)?/, ""), alt: a.alt, w: +a.width, h: +a.height };
  if (a.class) out.cls = a.class;
  for (const k of Object.keys(a)) if (!["src", "alt", "width", "height", "class", "loading", "decoding", "fetchpriority"].includes(k)) throw new Error("unexpected img attribute " + k);
  if (a.loading) out.lazy = true;
  if (a.fetchpriority) out.priority = a.fetchpriority;
  return out;
}
// Each parser returns typed data, or null when the section does not have exactly the expected shape.
// Output fidelity is checked end to end by scripts/compare.mjs.
const PARSERS = {
  note(sec) {
    if (sig(sec) !== "section.section.tight" || shape(sec) !== "div.wrap") return null;
    const w = kids(sec)[0]; if (shape(w) !== "p.note") return null;
    return { type: "note", html: html(kids(w)[0]) };
  },
  anchors(sec) {
    if (sig(sec) !== "div.wrap" || shape(sec) !== "ul.chips") return null;
    const ul = kids(sec)[0];
    const items = kids(ul).map((li) => { const a = kids(li)[0]; return a && kids(li).length === 1 && a.getAttribute("style") === "text-decoration:none" ? { href: a.getAttribute("href"), text: txt(a) } : null; });
    return items.every(Boolean) ? { type: "anchors", label: ul.getAttribute("aria-label"), items } : null;
  },
  faq(sec) {
    if (sig(sec) !== "section.line" || shape(sec) !== "div.wrap.prose") return null;
    const w = kids(sec)[0], [h2, ...rest] = kids(w);
    if (!h2 || sig(h2) !== "h2" || h2.getAttribute("style") !== "margin-bottom:14px" || !rest.length || !rest.every((d) => sig(d) === "details.faq" && shape(d) === "summary p")) return null;
    return { type: "faq", title: txt(h2), items: rest.map((d) => ({ q: txt(kids(d)[0]), a: html(kids(d)[1]) })) };
  },
  pageSteps(sec) {
    if (sig(sec) !== "section.line" || shape(sec) !== "div.wrap") return null;
    const w = kids(sec)[0]; if (shape(w) !== "h2 ol.steps div.btns") return null;
    const [h2, ol, btns] = kids(w), btn = kids(btns)[0];
    if (ol.getAttribute("style") !== "color:var(--ink)" || kids(btns).length !== 1) return null;
    const items = kids(ol).map((li) => shape(li) === "b p" && kids(li)[1].getAttribute("style") === "color:var(--muted)" ? { title: txt(kids(li)[0]), text: html(kids(li)[1]) } : null);
    if (!items.every(Boolean)) return null;
    return { type: "pageSteps", title: txt(h2), items, button: { text: txt(btn), copy: btn.getAttribute("data-copy") } };
  },
  aboutTrust(sec) {
    if (sig(sec) !== "section.line" || shape(sec) !== "div.wrap.trust") return null;
    const w = kids(sec)[0], [prose, contact] = kids(w);
    if (shape(w) !== "div.prose div" || !/^h2( p)+$/.test(shape(prose)) || shape(contact) !== "h3 p div.btns") return null;
    const [h2, ...ps] = kids(prose), [h3, cp, btns] = kids(contact), btn = kids(btns)[0];
    return { type: "aboutTrust", title: txt(h2), paras: ps.map(html), contactTitle: txt(h3), contactText: html(cp), button: { text: txt(btn), copy: btn.getAttribute("data-copy") } };
  },
  hero(sec) {
    if (sig(sec) !== "section.hero" || shape(sec) !== "img.bg div.s3d div.wrap") return null;
    const [img, s3d, w] = kids(sec); if (shape(w) !== "h1 p.lead div.actions") return null;
    const [h1, lead, actions] = kids(w), [order, cat] = kids(actions);
    if (shape(actions) !== "a.btn.lamp a.btn.on-dark") return null;
    return { type: "hero", img: imgData(img), scene: s3d.getAttribute("data-scene"), h1: html(h1), lead: html(lead),
      order: { text: txt(order), copy: order.getAttribute("data-copy") }, catalog: { href: cat.getAttribute("href"), text: txt(cat) } };
  },
  runtime(sec) {
    if (sig(sec) !== "section.runtime.wrap" || sec.getAttribute("id") !== "runtime") return null;
    const panel = kids(sec)[0]; if (shape(panel) !== "div.panel" && shape(sec) !== "div.panel") return null;
    const p = kids(sec)[0]; if (shape(p) !== "h2 p.sub fieldset.sizes div.rt-body div.rt-foot p.note") return null;
    const [h2, sub, fs, body, foot, note] = kids(p);
    return { type: "runtime", title: txt(h2), sub: html(sub), legend: txt(kids(fs)[0]), kwh: txt(body.querySelector("text.kwh")),
      modelsLabel: txt(foot.querySelector("span b")), note: html(note), svgLabel: body.querySelector("svg").getAttribute("aria-label") };
  },
  catGrid(sec) {
    if (sig(sec) !== "section.section" || sec.getAttribute("id") !== "products" || shape(sec) !== "div.wrap") return null;
    const w = kids(sec)[0]; if (shape(w) !== "div.section-head div.cat-grid") return null;
    const [head, grid] = kids(w); if (shape(head) !== "h2 p") return null;
    const cards = kids(grid).map((a) => {
      const size = sig(a).replace(/^a\.cat-card\.?/, "") || null;
      if (!sig(a).startsWith("a.cat-card") || shape(a) !== "div.pic div.txt") return null;
      const [pic, t] = kids(a); if (kids(pic).length !== 1 || kids(pic)[0].tagName !== "IMG" || shape(t) !== "h3 p span.go") return null;
      return { href: a.getAttribute("href"), size, img: imgData(kids(pic)[0]), title: txt(kids(t)[0]), text: html(kids(t)[1]), go: txt(kids(t)[2]) };
    });
    if (!cards.every(Boolean) || new Set(cards.map((c) => c.go)).size !== 1) return null;
    return { type: "catGrid", title: txt(kids(head)[0]), intro: html(kids(head)[1]), go: cards[0].go, cards: cards.map(({ go, ...c }) => c) };
  },
  homeTrust(sec) {
    if (sig(sec) !== "section.section.tight" || shape(sec) !== "div.wrap.trust") return null;
    const w = kids(sec)[0], [a, b] = kids(w);
    if (shape(w) !== "div div" || shape(a) !== "h2 p ul.facts" || shape(b) !== "h3 ul.certs p.note") return null;
    const [h2, p, facts] = kids(a), [h3, certs, note] = kids(b);
    return { type: "homeTrust", title: txt(h2), text: html(p), facts: kids(facts).map(html), certsTitle: txt(h3), certs: kids(certs).map(txt), note: html(note) };
  },
  bandSteps(sec) {
    if (sig(sec) !== "section.section.band" || shape(sec) !== "div.wrap") return null;
    const w = kids(sec)[0]; if (shape(w) !== "div.section-head ol.steps p") return null;
    const [head, ol, p] = kids(w), link = kids(p)[0];
    if (shape(head) !== "h2 p" || shape(p) !== "a.btn.lamp" || ol.getAttribute("style")) return null;
    const items = kids(ol).map((li) => shape(li) === "b p" ? { title: txt(kids(li)[0]), text: html(kids(li)[1]) } : null);
    if (!items.every(Boolean)) return null;
    return { type: "bandSteps", title: txt(kids(head)[0]), intro: html(kids(head)[1]), items, link: { href: link.getAttribute("href"), text: txt(link) } };
  },
  order(sec) {
    if (sig(sec) !== "section.section" || shape(sec) !== "div.wrap.order") return null;
    const w = kids(sec)[0], [t, btns] = kids(w);
    if (shape(w) !== "div div.btns" || shape(t) !== "h2 p" || shape(btns) !== "a.btn a.btn.ghost") return null;
    const [m, f] = kids(btns);
    return { type: "order", title: txt(kids(t)[0]), text: html(kids(t)[1]), messenger: { text: txt(m), copy: m.getAttribute("data-copy") }, facebook: { text: txt(f) } };
  }
};
function toTyped(sec) {
  for (const parse of Object.values(PARSERS)) { const r = parse(sec); if (r) return r; }
  return null;
}


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

// ---------- per-page content ----------
const PAGES = [
  ...cats.map((slug) => ({ slug, kind: "category" })),
  { slug: "about", kind: "content" },
  { slug: "green-loan", kind: "content" },
  { slug: "index", kind: "home" }
];
site.pages = PAGES;
let structured = 0, raw = 0, explicitCopy = 0;
rmSync(join(DATA, "categories"), { recursive: true, force: true }); // older layout of this folder
rmSync(join(DATA, "pages"), { recursive: true, force: true });
mkdirSync(join(DATA, "pages"), { recursive: true });
for (const { slug, kind } of PAGES) {
  const out = { slug, kind, scene: null, langs: {} };
  for (const l of LANGS) {
    const d = load(l, slug);
    const meta = (sel) => d.querySelector(sel)?.getAttribute("content");
    const head = d.querySelector("main > section.page-head");
    if ((kind === "home") !== !head) throw new Error(`${l}/${slug}: unexpected page-head presence`);
    const i18nScript = d.querySelectorAll("script").map((s) => s.text).find((t) => t.startsWith("window.I18N="));
    if (i18nScript && JSON.stringify(JSON.parse(i18nScript.slice(12).replace(/;\s*$/, ""))) !== JSON.stringify(site.i18n[l]))
      throw new Error(`${l}/${slug}: page-specific I18N dictionary not supported yet`);
    const page = {
      title: txt(d.querySelector("title")),
      description: must(meta('meta[name="description"]'), "description"),
      ogImage: meta('meta[property="og:image"]').replace("https://partastar.solar/", ""),
      sections: []
    };
    if (head) {
      out.scene = head.querySelector(".s3d")?.getAttribute("data-scene") ?? null;
      const h1 = head.querySelector("h1");
      Object.assign(page, {
        h1: txt(h1),
        ...(h1.getAttribute("style") !== "font-size:clamp(1.9rem,4.4vw,3rem)" ? { h1Style: h1.getAttribute("style") ?? null } : {}),
        crumb: head.querySelector(".crumbs").text.split("/").slice(1).join("/").trim(),
        introHtml: head.querySelector(".wrap > p:not(.crumbs)").innerHTML
      });
      const headKids = head.querySelector(".wrap").childNodes.filter((n) => n.nodeType === 1).map((n) => n.tagName + "." + n.classList.value.join("."));
      const expected = ["P.crumbs", "H1.", "P.", ...(out.scene ? ["DIV.s3d"] : [])].join(",");
      if (headKids.join(",") !== expected) throw new Error(`${l}/${slug}: unsupported page-head shape ${headKids}`);
    }
    for (const sec of d.querySelector("main").childNodes.filter((n) => n.nodeType === 1 && n !== head)) {
      const line = sec.tagName === "SECTION" && sec.classList.contains("line") ? toLine(sec, l) : null;
      if (line) { page.sections.push(line); structured++; explicitCopy += line.blocks.filter((b) => b.copy).length; }
      else {
        const typed = toTyped(sec);
        if (typed) { page.sections.push(typed); structured++; }
        else { page.sections.push({ type: "raw", html: sec.outerHTML, product: productMeta(sec) }); raw++; }
      }
    }
    out.langs[l] = page;
  }
  writeFileSync(join(DATA, "pages", slug + ".json"), JSON.stringify(out, null, 2) + "\n");
}
writeFileSync(join(DATA, "site.json"), JSON.stringify(site, null, 2) + "\n");
console.log(`pages=${PAGES.length} langs=${LANGS.length} structured lines=${structured} raw sections=${raw} lines with non-template copy text=${explicitCopy}`);

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
    else if (is(k, "div") && k.getAttribute("style") === GALLERY_STYLE && el(k).length &&
      el(k).every((d) => is(d, "div", "pic") && d.getAttribute("style") === "aspect-ratio:4/3" && el(d).length === 1 && el(d)[0].tagName === "IMG"))
      blocks.push({ k: "gallery", imgs: el(k).map((d) => imgData(el(d)[0])) });
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
