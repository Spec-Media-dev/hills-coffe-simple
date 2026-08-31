import type { MetadataRoute } from "next";
import type { Locale } from "@/i18n/routing";
import { getOfferList } from "@/lib/data/catalog";
import { getArticles, getOrigins } from "@/lib/data/editorial";
import { getPublishedSitePages } from "@/lib/data/site-content";
import { localizedUrl } from "@/lib/seo/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales: Locale[] = ["en", "ar"];
  const staticPaths = [
    "/",
    "/green-coffee-offer-list",
    "/coffee-origins",
    "/knowledge",
    "/contact",
  ];
  const cmsPaths = new Set([
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
  ]);
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    const [catalog, origins, articles, pages] = await Promise.all([
      getOfferList(locale),
      getOrigins(locale),
      getArticles(locale),
      getPublishedSitePages(locale),
    ]);
    for (const path of staticPaths)
      entries.push({
        url: localizedUrl(locale, path),
        changeFrequency:
          path === "/green-coffee-offer-list" ? "daily" : "weekly",
        priority: path === "/" ? 1 : 0.7,
      });
    for (const slug of new Set(catalog.offers.map((x) => x.slug)))
      entries.push({
        url: localizedUrl(locale, `/green-coffee-offer-list/${slug}`),
        changeFrequency: "daily",
        priority: 0.8,
      });
    for (const origin of origins)
      entries.push({
        url: localizedUrl(locale, `/coffee-origins/${origin.slug}`),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    for (const article of articles)
      entries.push({
        url: localizedUrl(locale, `/knowledge/${article.slug}`),
        lastModified: article.updated_at,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    for (const page of pages) {
      const path = page.route_path || `/${page.page_key}`;
      if (cmsPaths.has(path) && !staticPaths.includes(path))
        entries.push({
          url: localizedUrl(locale, path),
          lastModified: page.updated_at,
          changeFrequency: "monthly",
          priority: 0.6,
        });
    }
  }
  return entries;
}
