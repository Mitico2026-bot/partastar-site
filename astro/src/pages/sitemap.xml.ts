// sitemap.xml generated from the page list, so a new page or language is listed automatically.
// Order matches the original file: sorted by the page's file path; home pages are listed as directories.
import { LANGS, pages, dirOf, pageUrl } from "../lib/site";

/** Date written as <lastmod> for every URL. Bump it when content changes. */
const LASTMOD = "2026-11-04";

export function GET() {
  const entries = LANGS.flatMap((l) => pages.map(({ slug }) => ({ file: `${dirOf(l)}${slug}.html`, url: pageUrl(l, slug) })))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => `  <url><loc>${e.url}</loc><lastmod>${LASTMOD}</lastmod></url>`),
    "</urlset>",
    ""
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
