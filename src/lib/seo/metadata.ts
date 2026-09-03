import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import type { CmsPage } from "@/lib/data/site-content";
import { env } from "@/lib/env";

export function localizedUrl(locale: Locale, path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${env.NEXT_PUBLIC_SITE_URL}${locale === "en" ? "" : `/${locale}`}${clean === "/" ? "" : clean}`;
}

export function localizedMetadata({
  locale,
  path,
  paths,
  title,
  description,
  robots,
}: {
  locale: Locale;
  path: string;
  /**
   * Per-locale paths, for routes whose URL is not the same in every language.
   *
   * Most routes are the same path under a different prefix, so `path` alone is
   * right. A Knowledge article is not: its slug lives in the translation row,
   * so `/knowledge/green-coffee-complete-guide` and
   * `/ar/knowledge/dalil-alqahwa-al-khadra` are the same article. Without this
   * the `hreflang` alternates pointed at a URL that 404s.
   */
  paths?: Partial<Record<Locale, string>>;
  title: string;
  description?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const pathFor = (target: Locale) => paths?.[target] ?? path;
  const canonical = localizedUrl(locale, pathFor(locale));
  const alternateLocale = locale === "en" ? "ar_EG" : "en_US";
  return {
    title,
    description,
    robots,
    alternates: {
      canonical,
      languages: {
        en: localizedUrl("en", pathFor("en")),
        ar: localizedUrl("ar", pathFor("ar")),
        "x-default": localizedUrl("en", pathFor("en")),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: locale === "en" ? "en_US" : "ar_EG",
      alternateLocale: [alternateLocale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function cmsMetadata(
  page: CmsPage,
  locale: Locale,
  path: string,
): Metadata {
  return localizedMetadata({
    locale,
    path,
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.summary || undefined,
  });
}
