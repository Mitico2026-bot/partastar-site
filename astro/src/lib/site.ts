import site from "../data/site.json";

export const ORIGIN = "https://partastar.solar/";
export const MESSENGER = "https://m.me/61595385219266";
export const FACEBOOK = "https://www.facebook.com/profile.php?id=61595385219266";
export const ASSET_VERSION = { css: "20261103", app: "20261104", chat: "20261103" };

export type Lang = "mn" | "en" | "zh" | "ru" | "kk";
export const LANGS = site.langs as Lang[];
/** hreflang / lang attribute value per site language. */
export const HREFLANG: Record<Lang, string> = { mn: "mn", en: "en", zh: "zh-Hans", ru: "ru", kk: "kk" };

/** Mongolian lives at the site root; other languages in /<lang>/. */
export const dirOf = (l: Lang) => (l === "mn" ? "" : `${l}/`);
/** Relative prefix from a page in `l` back to the site root (for img/, style.css, ...). */
export const rootPrefix = (l: Lang) => (l === "mn" ? "" : "../");
export const pageUrl = (l: Lang, slug: string) => `${ORIGIN}${dirOf(l)}${slug}.html`;
/** Relative link from a page in `from` to the same page in `to`. */
export const langHref = (from: Lang, to: Lang, slug: string) =>
  from === to ? `${slug}.html` : `${rootPrefix(from)}${dirOf(to)}${slug}.html`;

export const ui = (l: Lang) => (site as any)[l];
export const i18nDict = (l: Lang) => (site.i18n as Record<string, unknown>)[l];
export const categories = site.categories as string[];

/** Messenger "ask for a quote" text: explicit text wins, otherwise the per-language template. */
export const quoteText = (l: Lang, name: string, explicit?: string) =>
  explicit ?? ui(l).copyTemplate.replace("{name}", name);

/**
 * Name/description/image for the JSON-LD product list.
 * Rule (matches the original site): a section is a product only if it has a picture column;
 * its description is the first lead inside that column.
 */
export function productOf(section: any) {
  if (section.type === "raw") return section.product;
  const top = section.blocks.find((b: any) => b.k === "top");
  if (!top) return null;
  const lead = top.parts.find((p: any) => p.k === "lead")?.text ?? null;
  return { id: section.id ?? null, name: section.name, lead, img: top.imgs[0]?.src ?? null };
}

export function jsonLd(l: Lang, slug: string, page: any) {
  const url = pageUrl(l, slug);
  const products = page.sections.map(productOf).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${ORIGIN}#org`, name: "Partastar Solar", url: ORIGIN, sameAs: [FACEBOOK] },
      { "@type": "WebSite", "@id": `${ORIGIN}#website`, name: "Partastar Solar", url: ORIGIN, publisher: { "@id": `${ORIGIN}#org` } },
      {
        "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: ui(l).crumbsHome, item: `${ORIGIN}${dirOf(l)}` },
          { "@type": "ListItem", position: 2, name: page.crumb, item: url }
        ]
      },
      {
        "@type": "ItemList", "@id": `${url}#products`,
        itemListElement: products.map((p: any, i: number) => ({
          "@type": "ListItem", position: i + 1,
          item: {
            // A section without an id stands for the whole page (e.g. car-power): page name, page URL.
            "@type": "Product", name: p.id ? p.name : page.h1, brand: { "@type": "Brand", name: "Partastar" }, url: p.id ? `${url}#${p.id}` : url,
            ...(p.lead ? { description: p.lead } : {}),
            ...(p.img ? { image: ORIGIN + p.img } : {})
          }
        }))
      },
      {
        "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.title, description: page.description,
        inLanguage: ui(l).htmlLang, isPartOf: { "@id": `${ORIGIN}#website` }, publisher: { "@id": `${ORIGIN}#org` },
        breadcrumb: { "@id": `${url}#breadcrumb` }, mainEntity: { "@id": `${url}#products` }
      }
    ]
  };
}
