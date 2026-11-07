# Partastar site: Astro version (migration in progress)

This folder rebuilds every page of the site, in all 5 languages, from structured data, plus `sitemap.xml`. The output is the same static HTML as the hand-written pages.

The live site is not affected yet. Vercel still deploys the original HTML from the repository root, and nothing here changes until the deploy is switched over.

## Status

| Part | State |
|---|---|
| All pages: 10 categories, `about`, `green-loan` and home, each in 5 languages, plus `404` (66 files) | Generated. All 66 match the originals node for node (`npm run compare`). The 9 sampled pages are pixel-identical in Chromium. |
| `sitemap.xml` | Generated from the page list. It has the same 65 URLs and `lastmod` values; only the order differs, which search engines ignore. |
| Images, `style.css`, `app.js`, `chat/chat.js`, `robots.txt`, `llms.txt` | Reused as-is. `npm run sync` copies them into `public/`, which is git-ignored. |
| Deploy | Not switched. Vercel still serves the original HTML from the repository root. |

## Commands

```sh
cd astro
npm ci              # install the pinned dependencies (astro, node-html-parser)
npm run dev         # local preview at http://localhost:4321/
npm run build       # writes static HTML to dist/
npm run compare     # diffs every dist/ page against the original page in the repo root
npm run check       # build + compare
npm run extract     # re-reads the original HTML into src/data/ (one-off migration step)
```

## Where things live

```
src/data/site.json                 header, footer, nav, button and toast text per language, plus the page list
src/data/pages/<slug>.json         one file per page with all 5 languages side by side;
                                   kind is "category", "content" (about, green-loan) or "home"
src/lib/site.ts                    URL scheme, hreflang, Messenger quote text, JSON-LD per page kind
src/layouts/Base.astro             <head>, header, category nav, footer, mobile bar, scripts
src/components/PageView.astro      page-head + sections for any page kind
src/components/ProductLine.astro   one product <section class="line">
src/pages/[...lang]/[slug].astro   /<slug>.html (Mongolian) and /<lang>/<slug>.html
src/pages/[...lang]/index.astro    the home page: /index.html and /<lang>/index.html
src/pages/404.astro                not-found page (Mongolian only, ported by hand)
src/pages/sitemap.xml.ts           sitemap from the page list (LASTMOD constant inside)
scripts/extract.mjs                HTML -> JSON extractor used for the migration
scripts/compare.mjs                page-by-page equivalence check against the originals
```

## Editing a product

Edit the product's block in `src/data/pages/<slug>.json`, in each language, then run `npm run check`.
- The Messenger "ask for a quote" text, the JSON-LD product list, the `hreflang` links and the page URLs are generated, so they can't drift.
- Once the originals are retired, `npm run compare` stops being meaningful. From that point the data files are the only source of truth.

## Data model notes

- A product line is an ordered list of blocks:
  - `top`: the picture column and header column (`h2`, then lead, facts, chips or prose parts, then the button);
  - `h2` and `lead`;
  - `button`;
  - `table`, `tblTitle` and `note`.
- A button's `copy` is stored only when it differs from the language's `copyTemplate`. This happens in 40 places where the original page uses a product-family name instead of the `h2`.
- 70 sections don't fit the model yet and are kept as raw HTML (`"type": "raw"`). They are still checked by `npm run compare`:
  - the home page's sections: hero, runtime calculator, category grid and so on (6 per language);
  - the prose sections of `about` and `green-loan` (2 each per language);
  - the home-storage runtime calculator, the "tight" note sections on heat pumps and EV chargers, and one commercial block.
- JSON-LD rule, matching the original pages: a section is a product only if it has a picture column, and its description is the first lead in that column.
