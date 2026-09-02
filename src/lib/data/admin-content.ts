import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Admin read paths for CMS pages, sections and articles.
 *
 * Every function re-checks `requireAdmin()`, and each returns the *draft*
 * truth — unlike `lib/data/site-content.ts`, which only ever returns published,
 * translated, valid content for the public site. Keeping the two separate is
 * what stops an Admin convenience from widening what a visitor can read.
 */

type Row = Record<string, unknown>;

async function adminDb() {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return null;
  return createSupabaseServerClient();
}

// ------------------------------------------------------------------ pages --

export type AdminPageRow = {
  id: string;
  pageKey: string;
  routePath: string | null;
  template: string;
  status: string;
  sortOrder: number;
  sectionCount: number;
  hasEnglish: boolean;
  hasArabic: boolean;
};

export async function listAdminPages(): Promise<{
  rows: AdminPageRow[];
  configured: boolean;
}> {
  const db = await adminDb();
  if (!db) return { rows: [], configured: false };

  const [pagesQ, sectionsQ, translationsQ] = await Promise.all([
    db
      .from("site_pages")
      .select("id,page_key,route_path,template,status,sort_order")
      .order("sort_order")
      .order("page_key"),
    db.from("site_page_sections").select("page_id"),
    db.from("site_page_translations").select("page_id,locale"),
  ]);

  const sectionCounts = new Map<string, number>();
  for (const row of sectionsQ.data ?? []) {
    const key = String(row.page_id);
    sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
  }
  const locales = new Map<string, Set<string>>();
  for (const row of translationsQ.data ?? []) {
    const key = String(row.page_id);
    const set = locales.get(key) ?? new Set<string>();
    set.add(String(row.locale));
    locales.set(key, set);
  }

  return {
    rows: (pagesQ.data ?? []).map((row) => ({
      id: String(row.id),
      pageKey: String(row.page_key),
      routePath: row.route_path ? String(row.route_path) : null,
      template: String(row.template),
      status: String(row.status),
      sortOrder: Number(row.sort_order ?? 0),
      sectionCount: sectionCounts.get(String(row.id)) ?? 0,
      hasEnglish: locales.get(String(row.id))?.has("en") ?? false,
      hasArabic: locales.get(String(row.id))?.has("ar") ?? false,
    })),
    configured: true,
  };
}

export type AdminSectionTranslation = {
  heading: string | null;
  subheading: string | null;
  bodyMarkdown: string | null;
  ctaLabel: string | null;
};

export type AdminSection = {
  id: string;
  sectionKey: string;
  sectionType: string;
  sortOrder: number;
  isVisible: boolean;
  mediaId: string | null;
  ctaHref: string | null;
  entityRef: string | null;
  entityLimit: number | null;
  translations: Record<"en" | "ar", AdminSectionTranslation | null>;
};

export type AdminPageDetail = {
  id: string;
  pageKey: string;
  routePath: string | null;
  template: string;
  status: string;
  sortOrder: number;
  translations: Record<
    "en" | "ar",
    {
      title: string;
      h1: string | null;
      summary: string | null;
      bodyMarkdown: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
    } | null
  >;
  sections: AdminSection[];
};

const emptyPair = <T>() => ({ en: null as T | null, ar: null as T | null });

export async function getAdminPage(
  pageId: string,
): Promise<AdminPageDetail | null> {
  const db = await adminDb();
  if (!db) return null;

  const { data: page } = await db
    .from("site_pages")
    .select("*")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return null;

  const [translationsQ, sectionsQ] = await Promise.all([
    db.from("site_page_translations").select("*").eq("page_id", pageId),
    db
      .from("site_page_sections")
      .select("*")
      .eq("page_id", pageId)
      .order("sort_order"),
  ]);

  const sections = (sectionsQ.data ?? []) as Row[];
  const sectionTranslationsQ = sections.length
    ? await db
        .from("site_page_section_translations")
        .select("*")
        .in(
          "section_id",
          sections.map((row) => String(row.id)),
        )
    : { data: [] as Row[] };

  const pageTranslations = emptyPair<AdminPageDetail["translations"]["en"]>();
  for (const row of translationsQ.data ?? []) {
    const locale = String(row.locale) as "en" | "ar";
    pageTranslations[locale] = {
      title: String(row.title),
      h1: row.h1 ? String(row.h1) : null,
      summary: row.summary ? String(row.summary) : null,
      bodyMarkdown: row.body_markdown ? String(row.body_markdown) : null,
      seoTitle: row.seo_title ? String(row.seo_title) : null,
      seoDescription: row.seo_description ? String(row.seo_description) : null,
    };
  }

  const sectionTranslations = new Map<
    string,
    Record<"en" | "ar", AdminSectionTranslation | null>
  >();
  for (const row of sectionTranslationsQ.data ?? []) {
    const key = String(row.section_id);
    const pair =
      sectionTranslations.get(key) ?? emptyPair<AdminSectionTranslation>();
    pair[String(row.locale) as "en" | "ar"] = {
      heading: row.heading ? String(row.heading) : null,
      subheading: row.subheading ? String(row.subheading) : null,
      bodyMarkdown: row.body_markdown ? String(row.body_markdown) : null,
      ctaLabel: row.cta_label ? String(row.cta_label) : null,
    };
    sectionTranslations.set(key, pair);
  }

  return {
    id: String(page.id),
    pageKey: String(page.page_key),
    routePath: page.route_path ? String(page.route_path) : null,
    template: String(page.template),
    status: String(page.status),
    sortOrder: Number(page.sort_order ?? 0),
    translations: pageTranslations,
    sections: sections.map((row) => ({
      id: String(row.id),
      sectionKey: String(row.section_key),
      sectionType: String(row.section_type),
      sortOrder: Number(row.sort_order ?? 0),
      isVisible: Boolean(row.is_visible),
      mediaId: row.media_id ? String(row.media_id) : null,
      ctaHref: row.cta_href ? String(row.cta_href) : null,
      entityRef: row.entity_ref ? String(row.entity_ref) : null,
      entityLimit:
        row.entity_limit === null || row.entity_limit === undefined
          ? null
          : Number(row.entity_limit),
      translations:
        sectionTranslations.get(String(row.id)) ??
        emptyPair<AdminSectionTranslation>(),
    })),
  };
}

// --------------------------------------------------------------- articles --

export type AdminArticleRow = {
  id: string;
  titleEn: string | null;
  titleAr: string | null;
  slugEn: string | null;
  categoryName: string | null;
  status: string;
  updatedAt: string;
  hasFeaturedMedia: boolean;
};

export async function listAdminArticles(): Promise<{
  rows: AdminArticleRow[];
  configured: boolean;
}> {
  const db = await adminDb();
  if (!db) return { rows: [], configured: false };

  const [articlesQ, translationsQ, categoriesQ] = await Promise.all([
    db
      .from("articles")
      .select("id,status,category_id,featured_media_id,updated_at")
      .order("updated_at", { ascending: false }),
    db.from("article_translations").select("article_id,locale,title,slug"),
    db.from("article_category_translations").select("category_id,locale,name"),
  ]);

  const titles = new Map<
    string,
    { locale: string; title: string; slug: string }[]
  >();
  for (const row of translationsQ.data ?? []) {
    const key = String(row.article_id);
    const list = titles.get(key) ?? [];
    list.push({
      locale: String(row.locale),
      title: String(row.title),
      slug: String(row.slug),
    });
    titles.set(key, list);
  }
  const categories = new Map<string, string>();
  for (const row of categoriesQ.data ?? [])
    if (String(row.locale) === "en")
      categories.set(String(row.category_id), String(row.name));

  return {
    rows: (articlesQ.data ?? []).map((row) => {
      const list = titles.get(String(row.id)) ?? [];
      const en = list.find((x) => x.locale === "en");
      const ar = list.find((x) => x.locale === "ar");
      return {
        id: String(row.id),
        titleEn: en?.title ?? null,
        titleAr: ar?.title ?? null,
        slugEn: en?.slug ?? null,
        categoryName: row.category_id
          ? (categories.get(String(row.category_id)) ?? null)
          : null,
        status: String(row.status),
        updatedAt: String(row.updated_at),
        hasFeaturedMedia: Boolean(row.featured_media_id),
      };
    }),
    configured: true,
  };
}

export type AdminArticleDetail = {
  id: string;
  categoryId: string | null;
  featuredMediaId: string | null;
  status: string;
  isFeatured: boolean;
  translations: Record<
    "en" | "ar",
    {
      slug: string;
      title: string;
      excerpt: string | null;
      bodyMarkdown: string | null;
    } | null
  >;
};

export async function getAdminArticle(
  articleId: string,
): Promise<AdminArticleDetail | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data: article } = await db
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .maybeSingle();
  if (!article) return null;
  const { data: translations } = await db
    .from("article_translations")
    .select("*")
    .eq("article_id", articleId);

  const pair = emptyPair<AdminArticleDetail["translations"]["en"]>();
  for (const row of translations ?? [])
    pair[String(row.locale) as "en" | "ar"] = {
      slug: String(row.slug),
      title: String(row.title),
      excerpt: row.excerpt ? String(row.excerpt) : null,
      bodyMarkdown: row.body_markdown ? String(row.body_markdown) : null,
    };

  return {
    id: String(article.id),
    categoryId: article.category_id ? String(article.category_id) : null,
    featuredMediaId: article.featured_media_id
      ? String(article.featured_media_id)
      : null,
    status: String(article.status),
    isFeatured: Boolean(article.is_featured),
    translations: pair,
  };
}

export async function listArticleCategories(locale: "en" | "ar") {
  const db = await adminDb();
  if (!db) return [];
  const [categoriesQ, translationsQ] = await Promise.all([
    db
      .from("article_categories")
      .select("id,slug")
      .eq("is_active", true)
      .order("sort_order"),
    db.from("article_category_translations").select("category_id,locale,name"),
  ]);
  const names = new Map<string, Map<string, string>>();
  for (const row of translationsQ.data ?? []) {
    const key = String(row.category_id);
    const inner = names.get(key) ?? new Map<string, string>();
    inner.set(String(row.locale), String(row.name));
    names.set(key, inner);
  }
  return (categoriesQ.data ?? []).map((row) => {
    const inner = names.get(String(row.id));
    return {
      value: String(row.id),
      label: inner?.get(locale) ?? inner?.get("en") ?? String(row.slug),
    };
  });
}
