import { pages, type PageKind } from "./site";

const files = import.meta.glob("../data/pages/*.json", { eager: true });
/** Page data by slug, loaded from src/data/pages/<slug>.json. */
export const pageData: Record<string, any> = Object.fromEntries(Object.values(files).map((m: any) => [m.default.slug, m.default]));
export const pagesOfKind = (pred: (k: PageKind) => boolean) => pages.filter((p) => pred(p.kind));
