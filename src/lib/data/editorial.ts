import "server-only";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickTranslation } from "./shared";

export async function getOrigins(locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [rowsQ, translationsQ] = await Promise.all([
    db
      .from("origins")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("featured_sort_order"),
    db.from("origin_translations").select("*"),
  ]);
  if (rowsQ.error || translationsQ.error)
    throw new Error("Origin data unavailable (upstream)");
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
          },
        ]
      : [];
  });
}
export async function getOriginBySlug(slug: string, locale: Locale) {
  return (await getOrigins(locale)).find((x) => x.slug === slug) ?? null;
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
