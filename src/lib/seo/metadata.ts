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
  absoluteTitle = false,
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
  paths?: Partial<Record<Locale, string | null>>;
  title: string;
  description?: string;
  robots?: Metadata["robots"];
  /** Keep a page title outside the root layout's `%s | Hills Coffee` template. */
  absoluteTitle?: boolean;
}): Metadata {
  const hasExplicitPaths = paths !== undefined;
  const pathFor = (target: Locale) => paths?.[target] ?? path;
  // An Arabic route that is rendering English fallback content must consolidate
  // to its real English URL instead of making the fallback look like Arabic.
  const canonicalLocale =
    locale === "ar" && hasExplicitPaths && !paths?.ar ? "en" : locale;
  const canonical = localizedUrl(canonicalLocale, pathFor(canonicalLocale));
  const alternateLocale = canonicalLocale === "en" ? "ar_EG" : "en_US";
  const languages: Record<string, string> = hasExplicitPaths
    ? {}
    : {
        en: localizedUrl("en", pathFor("en")),
        ar: localizedUrl("ar", pathFor("ar")),
        "x-default": localizedUrl("en", pathFor("en")),
      };

  if (hasExplicitPaths) {
    for (const target of ["en", "ar"] as const) {
      const targetPath = paths?.[target];
      if (targetPath) languages[target] = localizedUrl(target, targetPath);
    }
    if (paths?.en) languages["x-default"] = localizedUrl("en", paths.en);
  }

  const metadataTitle: Metadata["title"] = absoluteTitle
    ? { absolute: title }
    : title;
  return {
    title: metadataTitle,
    description,
    robots,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: canonicalLocale === "en" ? "en_US" : "ar_EG",
      ...(languages[canonicalLocale === "en" ? "ar" : "en"]
        ? { alternateLocale: [alternateLocale] }
        : {}),
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
  absoluteTitle = false,
): Metadata {
  return localizedMetadata({
    locale,
    path,
    paths: {
      en: page.availableLocales.includes("en") ? path : undefined,
      ar: page.availableLocales.includes("ar") ? path : undefined,
    },
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.summary || undefined,
    absoluteTitle,
  });
}
