import type { Locale } from "@/i18n/routing";
import { localizedUrl } from "@/lib/seo/metadata";

type ArticleSeoInput = {
  slug: string;
  title: string;
  excerpt?: string | null;
  lang?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

/**
 * Article structured data for /knowledge/[slug].
 *
 * Deliberately omits `author`: the schema has no author entity, and inventing a
 * Person node would be fabricated business data. Attribution is expressed
 * through the publisher Organization node emitted on the site root.
 */
export function articleJsonLd({
  article,
  locale,
  siteUrl,
  organizationName,
}: {
  article: ArticleSeoInput;
  locale: Locale;
  siteUrl: string;
  organizationName: string;
}) {
  const url = localizedUrl(locale, `/knowledge/${article.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    inLanguage: article.lang || locale,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    ...(article.updated_at ? { dateModified: article.updated_at } : {}),
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: organizationName,
    },
  };
}
