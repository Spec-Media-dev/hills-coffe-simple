import "server-only";
import type { Locale } from "@/i18n/routing";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickTranslation, storagePublicUrl } from "./shared";

/**
 * P6-T04 — active, non-deleted origins with a published-coffee count.
 *
 * The count comes from **one** additional query whose cost is independent of
 * how many origins exist: the published coffees' `origin_id` column is
 * fetched once and tallied, rather than issuing a count per origin. Three
 * queries total, whatever the catalog's size.
 */
export async function getOrigins(locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [rowsQ, translationsQ, coffeeCountsQ] = await Promise.all([
    db
      .from("origins")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("featured_sort_order"),
    db.from("origin_translations").select("*"),
    db
      .from("coffees")
      .select("origin_id")
      .eq("status", "PUBLISHED")
      .is("deleted_at", null),
  ]);
  if (rowsQ.error || translationsQ.error)
    throw new Error("Origin data unavailable (upstream)");
  const coffeeCounts = new Map<string, number>();
  for (const coffee of coffeeCountsQ.data ?? []) {
    const key = String(coffee.origin_id);
    coffeeCounts.set(key, (coffeeCounts.get(key) ?? 0) + 1);
  }
  return (rowsQ.data ?? []).flatMap((row) => {
    const t = pickTranslation(
      (translationsQ.data ?? []).filter((x) => x.origin_id === row.id),
      locale,
    );
    return t.translation
      ? [
          {
            ...row,
            name: t.translation.name,
            summary: t.translation.summary,
            story: t.translation.sourcing_story,
            cultivation: t.translation.cultivation_processing,
            sustainability: t.translation.sustainability,
            seoTitle: t.translation.seo_title,
            seoDescription: t.translation.seo_description,
            lang: t.translation.locale,
            coffeeCount: coffeeCounts.get(String(row.id)) ?? 0,
          },
        ]
      : [];
  });
}
export async function getOriginBySlug(slug: string, locale: Locale) {
  return (await getOrigins(locale)).find((x) => x.slug === slug) ?? null;
}

/**
 * The regions that belong to one origin, localized.
 *
 * Origin detail needs its dependent regions (P6-T04); they are read in a
 * single scoped query rather than by walking every region in the database.
 */
export async function getOriginRegions(originId: string, locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [rowsQ, translationsQ] = await Promise.all([
    db
      .from("regions")
      .select("id,slug")
      .eq("origin_id", originId)
      .eq("is_active", true)
      .is("deleted_at", null),
    db.from("region_translations").select("region_id,locale,name"),
  ]);
  return (rowsQ.data ?? [])
    .map((row) => {
      const candidates = (translationsQ.data ?? []).filter(
        (entry) => String(entry.region_id) === String(row.id),
      );
      return {
        id: String(row.id),
        slug: String(row.slug),
        name: String(
          candidates.find((entry) => entry.locale === locale)?.name ??
            candidates.find((entry) => entry.locale === "en")?.name ??
            row.slug,
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export async function getPublicOriginMedia(originId: string, locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const linksQ = await db
    .from("origin_media")
    .select("media_id,role,sort_order")
    .eq("origin_id", originId)
    .order("sort_order");
  const ids = (linksQ.data ?? []).map((link) => String(link.media_id));
  if (!ids.length) return [];
  const [mediaQ, translationsQ] = await Promise.all([
    db
      .from("media")
      .select("id,storage_bucket,storage_path,width,height")
      .in("id", ids)
      .is("deleted_at", null),
    db
      .from("media_translations")
      .select("media_id,locale,alt_text")
      .in("media_id", ids),
  ]);
  if (linksQ.error || mediaQ.error || translationsQ.error) return [];
  const { url } = getSupabaseConfig();
  const media = new Map(
    (mediaQ.data ?? []).map((item) => [String(item.id), item]),
  );
  return (linksQ.data ?? []).flatMap((link) => {
    const item = media.get(String(link.media_id));
    if (!item?.width || !item.height) return [];
    const translations = (translationsQ.data ?? []).filter(
      (entry) => String(entry.media_id) === String(link.media_id),
    );
    const alt =
      translations.find((entry) => entry.locale === locale)?.alt_text ??
      translations.find((entry) => entry.locale === "en")?.alt_text ??
      "";
    return [
      {
        id: String(item.id),
        role: link.role,
        sortOrder: link.sort_order,
        url: storagePublicUrl(url, item.storage_bucket, item.storage_path),
        width: Number(item.width),
        height: Number(item.height),
        alt: String(alt),
      },
    ];
  });
}

/**
 * One representative image per origin, for a list of origins at once.
 *
 * The origins index needs a picture for every row. Calling
 * `getPublicOriginMedia()` per origin would work and is exactly what the
 * detail page does, but it costs three round trips per origin — twenty
 * origins would mean sixty queries to render one page. This does the same
 * three queries with `in (...)` and buckets the result by origin.
 *
 * It is additive on purpose: `getPublicOriginMedia()` is untouched and the
 * detail page still uses it. It reads the same three tables that function
 * already reads publicly, so it exposes nothing new — it only exposes it
 * more cheaply.
 *
 * "Representative" means the row tagged HERO, falling back to the lowest
 * `sort_order`, which mirrors how the detail page picks its hero.
 */
export async function getPublicOriginHeroMedia(
  originIds: string[],
  locale: Locale,
): Promise<Map<string, { url: string; alt: string }>> {
  const out = new Map<string, { url: string; alt: string }>();
  if (!isSupabaseConfigured() || !originIds.length) return out;
  const db = await createSupabaseServerClient();

  const linksQ = await db
    .from("origin_media")
    .select("origin_id,media_id,role,sort_order")
    .in("origin_id", originIds)
    .order("sort_order");
  const links = linksQ.data ?? [];
  const ids = [...new Set(links.map((link) => String(link.media_id)))];
  if (linksQ.error || !ids.length) return out;

  const [mediaQ, translationsQ] = await Promise.all([
    db
      .from("media")
      .select("id,storage_bucket,storage_path,width,height")
      .in("id", ids)
      .is("deleted_at", null),
    db
      .from("media_translations")
      .select("media_id,locale,alt_text")
      .in("media_id", ids),
  ]);
  if (mediaQ.error || translationsQ.error) return out;

  const { url } = getSupabaseConfig();
  const media = new Map(
    (mediaQ.data ?? []).map((item) => [String(item.id), item]),
  );

  // Links arrive ordered by sort_order, so the first usable row for an origin
  // is already its fallback; a HERO row replaces whatever came before it.
  const chosen = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    const key = String(link.origin_id);
    const current = chosen.get(key);
    if (!current || (link.role === "HERO" && current.role !== "HERO"))
      chosen.set(key, link);
  }

  for (const [originId, link] of chosen) {
    const item = media.get(String(link.media_id));
    if (!item?.width || !item.height) continue;
    const translations = (translationsQ.data ?? []).filter(
      (entry) => String(entry.media_id) === String(link.media_id),
    );
    const alt =
      translations.find((entry) => entry.locale === locale)?.alt_text ??
      translations.find((entry) => entry.locale === "en")?.alt_text ??
      "";
    out.set(originId, {
      url: storagePublicUrl(url, item.storage_bucket, item.storage_path),
      alt: String(alt),
    });
  }
  return out;
}

export type ArticleMedia = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Published articles for the public site.
 *
 * Three visibility rules, all enforced here rather than trusted from the
 * caller: the status must be PUBLISHED, the row must not be soft-deleted, and
 * a future `published_at` is not yet public — the same embargo rule
 * `getSitePage` applies, so scheduling behaves consistently across content
 * types.
 *
 * Phase 8 added the featured image. It is resolved from
 * `articles.featured_media_id` — the relation the schema already had, which no
 * code consumed — and is dropped rather than rendered when the media row is
 * archived or carries no intrinsic dimensions, so retiring an image degrades
 * an article instead of breaking it (§17, §33).
 */
export async function getArticles(locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [rowsQ, translationsQ] = await Promise.all([
    db
      .from("articles")
      .select("*")
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .order("published_at", { ascending: false }),
    db.from("article_translations").select("*"),
  ]);
  if (rowsQ.error || translationsQ.error)
    throw new Error("Knowledge content unavailable (upstream)");

  const now = Date.now();
  const live = (rowsQ.data ?? []).filter(
    (row) => !row.published_at || new Date(row.published_at).getTime() <= now,
  );

  const mediaIds = [
    ...new Set(
      live.flatMap((row) =>
        row.featured_media_id ? [String(row.featured_media_id)] : [],
      ),
    ),
  ];
  const [mediaQ, mediaTranslationsQ] = mediaIds.length
    ? await Promise.all([
        db
          .from("media")
          .select("id,storage_bucket,storage_path,width,height")
          .in("id", mediaIds)
          .is("deleted_at", null),
        db
          .from("media_translations")
          .select("media_id,locale,alt_text")
          .in("media_id", mediaIds),
      ])
    : [{ data: [] }, { data: [] }];

  const { url } = getSupabaseConfig();
  const mediaMap = new Map<string, ArticleMedia>();
  for (const media of mediaQ.data ?? []) {
    if (!media.width || !media.height) continue;
    const translations = (mediaTranslationsQ.data ?? []).filter(
      (row) => row.media_id === media.id,
    );
    const alt =
      translations.find((row) => row.locale === locale)?.alt_text ??
      translations.find((row) => row.locale === "en")?.alt_text ??
      "";
    mediaMap.set(String(media.id), {
      url: storagePublicUrl(url, media.storage_bucket, media.storage_path),
      width: Number(media.width),
      height: Number(media.height),
      alt: String(alt),
    });
  }

  return live.flatMap((row) => {
    const t = pickTranslation(
      (translationsQ.data ?? []).filter((x) => x.article_id === row.id),
      locale,
    );
    return t.translation
      ? [
          {
            ...row,
            slug: t.translation.slug,
            title: t.translation.title,
            excerpt: t.translation.excerpt,
            bodyMarkdown: t.translation.body_markdown,
            seoTitle: t.translation.seo_title,
            seoDescription: t.translation.seo_description,
            lang: t.translation.locale,
            featuredMedia: row.featured_media_id
              ? (mediaMap.get(String(row.featured_media_id)) ?? null)
              : null,
          },
        ]
      : [];
  });
}
export async function getArticleBySlug(slug: string, locale: Locale) {
  return (await getArticles(locale)).find((x) => x.slug === slug) ?? null;
}
