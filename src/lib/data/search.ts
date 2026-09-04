import "server-only";
import type { Locale } from "@/i18n/routing";
import { queryCatalog, type CatalogRow } from "@/lib/data/catalog-query";
import { getArticles, getOrigins } from "@/lib/data/editorial";
import { getPublishedSitePages } from "@/lib/data/site-content";

/**
 * Site-wide search across the public surfaces.
 *
 * Every branch composes a **reader that already applies the published rules**
 * rather than issuing its own query:
 *
 * - coffees → `queryCatalog`, which is the module that structurally selects no
 *   price column and already constrains `is_visible`, `status = PUBLISHED` and
 *   `deleted_at IS NULL`;
 * - origins → `getOrigins`, already `is_active` and already limited to origins
 *   that have published coffees;
 * - articles → `getArticles`, already published and embargo-aware;
 * - pages → `getPublishedSitePages`, already published, active and embargoed.
 *
 * That is the security design, not an implementation convenience. A bespoke
 * search query would have to restate all four sets of visibility rules, and any
 * one of them restated wrongly would be a disclosure bug. Because nothing here
 * reads a table directly, **search cannot widen what the site already exposes**
 * and it cannot return a price.
 */

export type SearchCoffee = Pick<
  CatalogRow,
  "id" | "slug" | "name" | "origin" | "region" | "process" | "warehouse"
>;

export type SearchOrigin = {
  slug: string;
  name: string;
  summary: string | null;
};

export type SearchArticle = {
  slug: string;
  title: string;
  excerpt: string | null;
};

export type SearchPage = {
  href: string;
  title: string;
  description: string | null;
};

export type SearchResults = {
  query: string;
  coffees: SearchCoffee[];
  origins: SearchOrigin[];
  articles: SearchArticle[];
  pages: SearchPage[];
  total: number;
};

/** Per-section cap, so one very common word cannot return the whole catalog. */
const SECTION_LIMIT = 8;

const EMPTY = (query: string): SearchResults => ({
  query,
  coffees: [],
  origins: [],
  articles: [],
  pages: [],
  total: 0,
});

/**
 * Case- and diacritic-tolerant containment.
 *
 * `localeCompare` cannot answer "contains", and Arabic content is routinely
 * written with and without diacritics, so a reader searching "بن" should still
 * match "بُن". Stripping combining marks before comparing costs nothing at
 * these list sizes and avoids a whole class of "no results" that are really
 * just typography.
 */
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    // Latin combining marks (U+0300-U+036F), then Arabic harakat (U+064B-U+0652).
    .replace(/[̀-ًͯ-ْ]/g, "")
    .toLowerCase()
    .trim();

const matches = (needle: string, ...haystack: (string | null | undefined)[]) =>
  haystack.some((value) => value && normalize(value).includes(needle));

export async function search(
  locale: Locale,
  rawQuery: string,
): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (!query) return EMPTY(query);
  const needle = normalize(query);
  if (!needle) return EMPTY(query);

  /*
   * The coffee half is delegated to the catalog query so the database does the
   * filtering and only one page of rows crosses the wire. Origins, articles and
   * pages are small, already-published reference sets that the site loads
   * wholesale elsewhere, so filtering them in process is cheaper than four more
   * round trips — and it lets Arabic diacritics be handled consistently.
   */
  const [catalog, origins, articles, pages] = await Promise.all([
    queryCatalog(locale, { q: query, page: 1 }),
    getOrigins(locale).catch(() => []),
    getArticles(locale).catch(() => []),
    getPublishedSitePages(locale).catch(() => []),
  ]);

  const coffees: SearchCoffee[] = catalog.rows
    .slice(0, SECTION_LIMIT)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      origin: row.origin,
      region: row.region,
      process: row.process,
      warehouse: row.warehouse,
    }));

  const originHits: SearchOrigin[] = origins
    .filter((origin) =>
      matches(needle, origin.name, origin.summary, origin.slug),
    )
    .slice(0, SECTION_LIMIT)
    .map((origin) => ({
      slug: String(origin.slug),
      name: String(origin.name),
      summary: origin.summary ? String(origin.summary) : null,
    }));

  const articleHits: SearchArticle[] = articles
    .filter((article) =>
      matches(needle, article.title, article.excerpt, article.slug),
    )
    .slice(0, SECTION_LIMIT)
    .map((article) => ({
      slug: String(article.slug),
      title: String(article.title),
      excerpt: article.excerpt ? String(article.excerpt) : null,
    }));

  const pageHits: SearchPage[] = pages
    .filter((page) => matches(needle, page.title, page.description))
    .slice(0, SECTION_LIMIT)
    .map((page) => ({
      // `route_path` is stored with a trailing slash; the router wants none.
      href: String(page.route_path).replace(/\/$/, "") || "/",
      title: String(page.title),
      description: page.description ? String(page.description) : null,
    }));

  return {
    query,
    coffees,
    origins: originHits,
    articles: articleHits,
    pages: pageHits,
    total:
      coffees.length + originHits.length + articleHits.length + pageHits.length,
  };
}
