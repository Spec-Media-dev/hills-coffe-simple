import type { MetadataRoute } from "next";
import type { Locale } from "@/i18n/routing";
import { getOfferList } from "@/lib/data/catalog";
import { getArticles, getOrigins } from "@/lib/data/editorial";
import { getPublishedSitePages } from "@/lib/data/site-content";
import { localizedUrl } from "@/lib/seo/metadata";

/**
 * The public sitemap: only 200, indexable, canonical, published URLs.
 *
 * Every entry carries its `en`/`ar` alternates, so the two language versions of
 * a page are declared as one another's equivalents rather than as two unrelated
 * URLs. That matters most for Knowledge articles, whose slug genuinely differs
 * per language — the English and Arabic URLs are not the same string with a
 * prefix, and pairing them by naive concatenation would advertise a URL that
 * 404s.
 *
 * `lastModified` is emitted only where a real timestamp backs it. A sitemap
 * that stamps "now" on every URL on every request tells a crawler nothing
 * except that it cannot be trusted.
 */

const LOCALES: Locale[] = ["en", "ar"];

/** Trailing slashes are stripped: this site serves non-trailing-slash URLs. */
const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

/**
 * Static routes that exist as real pages in the app router.
 *
 * `/about` is here because it is a real static route and one of the handful of
 * pages that represent the business — it was previously reachable only if a
 * CMS page happened to claim `/about`, which meant the About page was absent
 * from the sitemap entirely while that row stayed in draft.
 */
const STATIC_PATHS = [
  "/",
  "/green-coffee-offer-list",
  "/coffee-origins",
  "/knowledge",
  "/about",
  "/contact",
  // Public since the Owner Alignment addendum: an anonymous visitor can
  // complete a real RFQ here, so it is indexable and belongs in the map.
  "/request-a-quote",
];

/**
 * CMS routes allowed into the sitemap once their page is published.
 *
 * An allow-list, not a discovery mechanism: a published CMS page at an
 * unregistered path stays out of the index until it is added here deliberately,
 * which is what keeps "no unregistered indexable route" true.
 *
 * Stored `route_path` values carry a trailing slash (`/privacy/`) while this
 * list and the router do not. Both sides are normalized before comparison —
 * without that, no CMS page could ever match, and every one of them would be
 * silently missing from the sitemap the moment the owner published it.
 */
const CMS_PATHS = new Set(
  [
    "/about",
    "/green-coffee-beans-supplier",
    "/coffee-beans-supplier",
    "/wholesale-coffee-beans",
    "/specialty-coffee-beans",
    "/arabica-coffee-beans-wholesale",
    "/robusta-coffee-beans-wholesale",
    "/raw-coffee-beans-for-roasters",
    "/bulk-coffee-beans",
    "/coffee-beans-wholesale-price",
    "/privacy",
    "/terms",
  ].map(normalize),
);

type Entry = {
  /** Path per locale — identical for most routes, per-slug for articles. */
  paths: Record<Locale, string>;
  lastModified?: string | Date;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority?: number;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * Both locales are read once and merged into locale-agnostic entries, so an
   * entry knows its own English and Arabic URL and can declare the pair.
   */
  const [en, ar] = await Promise.all(
    LOCALES.map(async (locale) => {
      const [catalog, origins, articles, pages] = await Promise.all([
        getOfferList(locale),
        getOrigins(locale),
        getArticles(locale),
        getPublishedSitePages(locale),
      ]);
      return { locale, catalog, origins, articles, pages };
    }),
  );

  const entries: Entry[] = [];
  const both = (path: string) => ({ en: path, ar: path });

  for (const path of STATIC_PATHS)
    entries.push({
      paths: both(path),
      changeFrequency: path === "/green-coffee-offer-list" ? "daily" : "weekly",
      priority: path === "/" ? 1 : 0.7,
    });

  // Coffee lots. Slugs are language-independent, so one path serves both.
  for (const slug of new Set(en.catalog.offers.map((offer) => offer.slug)))
    entries.push({
      paths: both(`/green-coffee-offer-list/${slug}`),
      changeFrequency: "daily",
      priority: 0.8,
    });

  for (const origin of en.origins)
    entries.push({
      paths: both(`/coffee-origins/${origin.slug}`),
      // Real row timestamp where the reader exposes one; never a synthetic date.
      lastModified: origin.updated_at ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });

  /*
   * Articles are the one type whose URL differs per language, so the English
   * and Arabic slugs are paired explicitly from the translation rows the
   * reader already loaded. An article with no Arabic translation is emitted
   * for English only rather than pointed at a URL that does not exist.
   */
  for (const article of en.articles) {
    const arabic = ar.articles.find((candidate) => candidate.id === article.id);
    entries.push({
      paths: {
        en: `/knowledge/${article.slug}`,
        ar: `/knowledge/${arabic?.slug ?? article.slug}`,
      },
      lastModified: article.updated_at ?? undefined,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const page of en.pages) {
    const path = normalize(String(page.route_path || `/${page.page_key}`));
    if (!CMS_PATHS.has(path)) continue;
    // A CMS page that also has a static route is already listed above.
    if (STATIC_PATHS.includes(path)) continue;
    entries.push({
      paths: both(path),
      lastModified: page.updated_at ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries.flatMap((entry) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(locale, entry.paths[locale]),
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: {
          en: localizedUrl("en", entry.paths.en),
          ar: localizedUrl("ar", entry.paths.ar),
          "x-default": localizedUrl("en", entry.paths.en),
        },
      },
    })),
  );
}
