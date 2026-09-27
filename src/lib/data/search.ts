import "server-only";
import type { Locale } from "@/i18n/routing";
import {
  queryCatalog,
  type CatalogRow,
  type CatalogRowDetail,
} from "@/lib/data/catalog-query";
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

/**
 * A coffee result is the catalog row itself — the same public, price-free
 * shape the offer list renders — so the results page can reuse the catalog
 * row UI instead of a thinner parallel model.
 */
export type SearchCoffee = CatalogRow;

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
  /** Expandable-preview fields for exactly the coffees above. */
  coffeeDetails: Map<string, CatalogRowDetail>;
  /** Every matching coffee, which can exceed the rows shown here. */
  coffeeTotal: number;
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
  coffeeDetails: new Map(),
  coffeeTotal: 0,
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
  /*
   * The expandable fields are requested through the catalog query itself,
   * which reads them in parallel with the row translations; the whole coffee
   * branch still runs in parallel with the origin/article/page reads. The
   * detail read is bounded by these rows' ids and, like the rest of the
   * catalog query, selects no price column.
   */
  const coffeeBranch = queryCatalog(
    locale,
    { q: query, page: 1 },
    { withDetails: true },
  ).then((catalog) => ({
    rows: catalog.rows.slice(0, SECTION_LIMIT),
    total: catalog.total,
    details: catalog.details ?? new Map<string, CatalogRowDetail>(),
  }));
  const [catalog, origins, articles, pages] = await Promise.all([
    coffeeBranch,
    getOrigins(locale).catch(() => []),
    getArticles(locale).catch(() => []),
    getPublishedSitePages(locale).catch(() => []),
  ]);

  const coffees: SearchCoffee[] = catalog.rows;

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
    coffeeDetails: catalog.details,
    coffeeTotal: catalog.total,
    origins: originHits,
    articles: articleHits,
    pages: pageHits,
    total:
      coffees.length + originHits.length + articleHits.length + pageHits.length,
  };
}

// ---------------------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------------------

export type Suggestion =
  | {
      kind: "coffee";
      id: string;
      href: string;
      title: string;
      /** Origin · region · process, only the values that exist. */
      meta: string;
      imageUrl: string | null;
      lang?: string;
    }
  | {
      kind: "origin";
      id: string;
      href: string;
      title: string;
      meta: string | null;
      lang?: string;
    };

export type SuggestResponse = {
  query: string;
  items: Suggestion[];
  /** All matching coffees, so the dropdown can say how many a full search has. */
  coffeeTotal: number;
};

/** Coffees are what buyers type for; origins are a short supporting group. */
const SUGGEST_COFFEES = 6;
const SUGGEST_ORIGINS = 3;
/** Shorter than this matches too much to be useful and costs a query each. */
export const SUGGEST_MIN_LENGTH = 2;
/** Anything longer is not a search term; it is also cut before any query. */
const SUGGEST_MAX_LENGTH = 80;

/**
 * Typeahead suggestions for the header search.
 *
 * Built from the same published-only readers as `search()` — `queryCatalog`
 * for coffees (database-side filtering, one bounded page, no price column)
 * and `getOrigins` for origins — so a suggestion can never show anything the
 * site does not already publish, and can never carry a price.
 */
export async function suggest(
  locale: Locale,
  rawQuery: string,
): Promise<SuggestResponse> {
  const query = rawQuery.trim().slice(0, SUGGEST_MAX_LENGTH);
  const needle = normalize(query);
  if (needle.length < SUGGEST_MIN_LENGTH)
    return { query, items: [], coffeeTotal: 0 };

  const [catalog, origins] = await Promise.all([
    queryCatalog(locale, { q: query, page: 1 }),
    getOrigins(locale).catch(() => []),
  ]);

  // One suggestion per coffee: several offers of the same coffee (one per
  // warehouse) would otherwise repeat the same name.
  const seen = new Set<string>();
  const coffees: Suggestion[] = [];
  for (const row of catalog.rows) {
    if (seen.has(row.coffeeId)) continue;
    seen.add(row.coffeeId);
    coffees.push({
      kind: "coffee",
      id: row.coffeeId,
      href: `/green-coffee-offer-list/${row.slug}`,
      title: row.name,
      meta: [row.origin, row.region, row.process].filter(Boolean).join(" · "),
      imageUrl: row.imageUrl,
    });
    if (coffees.length === SUGGEST_COFFEES) break;
  }

  const originItems: Suggestion[] = origins
    .filter((origin) => matches(needle, origin.name, origin.slug))
    .slice(0, SUGGEST_ORIGINS)
    .map((origin) => ({
      kind: "origin",
      id: String(origin.id),
      href: `/coffee-origins/${origin.slug}`,
      title: String(origin.name),
      meta: origin.summary ? String(origin.summary) : null,
      lang: origin.lang ? String(origin.lang) : undefined,
    }));

  return {
    query,
    items: [...coffees, ...originItems],
    coffeeTotal: catalog.total,
  };
}
