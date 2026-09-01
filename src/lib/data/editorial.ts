import "server-only";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickTranslation } from "./shared";

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
  return (rowsQ.data ?? []).flatMap((row) => {
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
          },
        ]
      : [];
  });
}
export async function getArticleBySlug(slug: string, locale: Locale) {
  return (await getArticles(locale)).find((x) => x.slug === slug) ?? null;
}
