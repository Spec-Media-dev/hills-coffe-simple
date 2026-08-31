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
  title,
  description,
  robots,
}: {
  locale: Locale;
  path: string;
  title: string;
  description?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const canonical = localizedUrl(locale, path);
  const alternateLocale = locale === "en" ? "ar_EG" : "en_US";
  return {
    title,
    description,
    robots,
    alternates: {
      canonical,
      languages: {
        en: localizedUrl("en", path),
        ar: localizedUrl("ar", path),
        "x-default": localizedUrl("en", path),
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
