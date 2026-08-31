import "server-only";
import type { Locale } from "@/i18n/routing";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SitePage, SiteSection } from "@/lib/supabase/types.generated";
import { groupBy, pickTranslation, storagePublicUrl } from "./shared";

export type CmsMedia = {
  url: string;
  width: number;
  height: number;
  alt: string;
};
export type CmsSection = SiteSection & {
  heading: string | null;
  subheading: string | null;
  bodyMarkdown: string | null;
  ctaLabel: string | null;
  lang: Locale | "en";
  media: CmsMedia | null;
};
export type CmsPage = SitePage & {
  title: string;
  h1: string | null;
  summary: string | null;
  bodyMarkdown: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  lang: Locale | "en";
  sections: CmsSection[];
};

export async function getSitePage(
  pageKey: string,
  locale: Locale,
): Promise<CmsPage | null> {
  if (!isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const { data: page, error } = await db
    .from("site_pages")
    .select("*")
    .eq("page_key", pageKey)
    .eq("status", "PUBLISHED")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error)
    throw new Error(`Site content unavailable (${error.code ?? "upstream"})`);
  if (!page) return null;
  if (page.published_at && new Date(page.published_at) > new Date())
    return null;
  const [translationsQ, sectionsQ] = await Promise.all([
    db.from("site_page_translations").select("*").eq("page_id", page.id),
    db
      .from("site_page_sections")
      .select("*")
      .eq("page_id", page.id)
      .eq("is_visible", true)
      .order("sort_order"),
  ]);
  if (translationsQ.error || sectionsQ.error)
    throw new Error("Site content unavailable (upstream)");
  const translation = pickTranslation(translationsQ.data ?? [], locale);
  if (!translation.translation) return null;
  const sections = sectionsQ.data ?? [];
  const sectionIds = sections.map((x) => x.id);
  const mediaIds = sections.flatMap((x) => (x.media_id ? [x.media_id] : []));
  const [sectionTranslationsQ, mediaQ] = await Promise.all([
    sectionIds.length
      ? db
          .from("site_page_section_translations")
          .select("*")
          .in("section_id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
    mediaIds.length
      ? db.from("media").select("*").in("id", mediaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sectionTranslationsQ.error || mediaQ.error)
    throw new Error("Site content unavailable (upstream)");
  const mediaRows = mediaQ.data ?? [];
  const mediaTranslationQ = mediaRows.length
    ? await db
        .from("media_translations")
        .select("*")
        .in(
          "media_id",
          mediaRows.map((x) => x.id),
        )
    : { data: [], error: null };
  const sectionTranslations = groupBy(
    sectionTranslationsQ.data ?? [],
    (x) => x.section_id,
  );
  const mediaTranslations = groupBy(
    mediaTranslationQ.data ?? [],
    (x) => x.media_id,
  );
  const mediaMap = new Map(mediaRows.map((x) => [x.id, x]));
  const { url } = getSupabaseConfig();
  return {
    ...page,
    title: translation.translation.title,
    h1: translation.translation.h1,
    summary: translation.translation.summary,
    bodyMarkdown: translation.translation.body_markdown,
    seoTitle: translation.translation.seo_title,
    seoDescription: translation.translation.seo_description,
    lang: translation.translation.locale,
    sections: sections.flatMap((section) => {
      const sectionT = pickTranslation(
        sectionTranslations.get(section.id) ?? [],
        locale,
      );
      if (!sectionT.translation) return [];
      const media = section.media_id ? mediaMap.get(section.media_id) : null;
      const mediaT = media
        ? pickTranslation(mediaTranslations.get(media.id) ?? [], locale)
            .translation
        : null;
      return [
        {
          ...section,
          heading: sectionT.translation.heading,
          subheading: sectionT.translation.subheading,
          bodyMarkdown: sectionT.translation.body_markdown,
          ctaLabel: sectionT.translation.cta_label,
          lang: sectionT.translation.locale,
          media:
            media && media.width && media.height
              ? {
                  url: storagePublicUrl(
                    url,
                    media.storage_bucket,
                    media.storage_path,
                  ),
                  width: media.width,
                  height: media.height,
                  alt: mediaT?.alt_text ?? "",
                }
              : null,
        },
      ];
    }),
  };
}

export async function getPublishedSitePages(locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [pagesQ, translationsQ] = await Promise.all([
    db
      .from("site_pages")
      .select("id,page_key,route_path,updated_at,published_at")
      .eq("status", "PUBLISHED")
      .eq("is_active", true)
      .is("deleted_at", null),
    db
      .from("site_page_translations")
      .select("page_id,title,seo_description,locale")
      .in("locale", [locale, "en"]),
  ]);
  if (pagesQ.error || translationsQ.error)
    throw new Error("Published pages unavailable (upstream)");
  return (pagesQ.data ?? []).flatMap((page) => {
    if (page.published_at && new Date(page.published_at) > new Date())
      return [];
    const t = pickTranslation(
      (translationsQ.data ?? []).filter((x) => x.page_id === page.id),
      locale,
    ).translation;
    return t
      ? [
          {
            ...page,
            title: t.title,
            description: t.seo_description,
            lang: t.locale,
          },
        ]
      : [];
  });
}

export async function getSiteSettings(locale: Locale) {
  if (!isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const [settingsQ, translationsQ] = await Promise.all([
    db.from("site_settings").select("*").limit(1).maybeSingle(),
    db.from("site_settings_translations").select("*"),
  ]);
  if (settingsQ.error || translationsQ.error)
    throw new Error("Site settings unavailable (upstream)");
  if (!settingsQ.data) return null;
  const translation = pickTranslation(translationsQ.data ?? [], locale);
  return {
    ...settingsQ.data,
    displayName:
      translation.translation?.org_display_name ??
      settingsQ.data.org_brand_name,
    tagline: translation.translation?.org_tagline ?? null,
    address: translation.translation?.org_address ?? null,
    lang: translation.translation?.locale ?? "en",
  };
}

export async function getWarehouses(locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [rowsQ, translationsQ] = await Promise.all([
    db.from("warehouses").select("*").eq("is_active", true),
    db.from("warehouse_translations").select("*"),
  ]);
  if (rowsQ.error || translationsQ.error)
    throw new Error("Warehouse data unavailable (upstream)");
  const translations = groupBy(translationsQ.data ?? [], (x) => x.warehouse_id);
  return (rowsQ.data ?? []).map((row) => {
    const t = pickTranslation(
      translations.get(row.id) ?? [],
      locale,
    ).translation;
    return {
      ...row,
      displayName: t?.name ?? row.name,
      displayCity: t?.city ?? row.city,
      displayAddress: t?.address ?? row.address,
      displayRegion: t?.service_region ?? row.service_region,
      lang: t?.locale ?? "en",
    };
  });
}
