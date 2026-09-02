import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { MEDIA_BUCKET } from "@/lib/media/upload";
import { isSupabaseConfigured, getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storagePublicUrl } from "./shared";

/**
 * The Admin Media Library read path (P8-T03).
 *
 * `requireAdmin()` is re-checked here rather than inherited from the layout,
 * as in every other Admin data module.
 *
 * The library is a single shelf: one upload serves coffees, origins, articles,
 * CMS sections and the site logo. That is only safe if the Admin can see what
 * a given item is holding up before archiving it, which is what
 * `findMediaReferences` is for.
 */

export const MEDIA_PAGE_SIZE = 24;

export type MediaItem = {
  id: string;
  url: string;
  storagePath: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  isPublic: boolean;
  archived: boolean;
  createdAt: string;
  altEn: string | null;
  altAr: string | null;
  captionEn: string | null;
  captionAr: string | null;
};

export type MediaPage = {
  items: MediaItem[];
  total: number;
  page: number;
  pageCount: number;
  configured: boolean;
};

const EMPTY: MediaPage = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 0,
  configured: false,
};

type Row = Record<string, unknown>;

function toItem(
  row: Row,
  translations: Map<
    string,
    { locale: string; alt: string | null; caption: string | null }[]
  >,
  projectUrl: string,
): MediaItem {
  const id = String(row.id);
  const t = translations.get(id) ?? [];
  const forLocale = (locale: string) => t.find((x) => x.locale === locale);
  return {
    id,
    url: storagePublicUrl(
      projectUrl,
      String(row.storage_bucket),
      String(row.storage_path),
    ),
    storagePath: String(row.storage_path),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    width:
      row.width === null || row.width === undefined ? null : Number(row.width),
    height:
      row.height === null || row.height === undefined
        ? null
        : Number(row.height),
    sizeBytes:
      row.file_size_bytes === null || row.file_size_bytes === undefined
        ? null
        : Number(row.file_size_bytes),
    isPublic: Boolean(row.is_public),
    archived: Boolean(row.deleted_at),
    createdAt: String(row.created_at),
    altEn: forLocale("en")?.alt ?? null,
    altAr: forLocale("ar")?.alt ?? null,
    captionEn: forLocale("en")?.caption ?? null,
    captionAr: forLocale("ar")?.caption ?? null,
  };
}

async function translationsFor(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ids: string[],
) {
  const map = new Map<
    string,
    { locale: string; alt: string | null; caption: string | null }[]
  >();
  if (!ids.length) return map;
  const { data } = await db
    .from("media_translations")
    .select("media_id,locale,alt_text,caption")
    .in("media_id", ids);
  for (const row of data ?? []) {
    const key = String(row.media_id);
    const list = map.get(key) ?? [];
    list.push({
      locale: String(row.locale),
      alt: row.alt_text ? String(row.alt_text) : null,
      caption: row.caption ? String(row.caption) : null,
    });
    map.set(key, list);
  }
  return map;
}

export type MediaFilters = {
  query?: string;
  /** "active" (default), "archived", or "all". */
  state?: string;
  page?: number;
};

export async function listMedia(filters: MediaFilters): Promise<MediaPage> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return EMPTY;
  const db = await createSupabaseServerClient();
  const page = Math.max(1, filters.page || 1);
  const from = (page - 1) * MEDIA_PAGE_SIZE;

  let query = db.from("media").select("*", { count: "exact" });
  if (filters.state === "archived") query = query.not("deleted_at", "is", null);
  else if (filters.state !== "all") query = query.is("deleted_at", null);

  // Search runs against the storage path here; alt text lives in a separate
  // table and is matched below, so a path search stays one bounded query.
  const term = filters.query?.replace(/[(),*]/g, " ").trim();
  if (term) query = query.ilike("storage_path", `%${term}%`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + MEDIA_PAGE_SIZE - 1);

  if (error) {
    if (error.code === "PGRST103")
      return { ...EMPTY, page, total: count ?? 0, configured: true };
    console.error(`[media-library] list failed: ${error.code ?? "upstream"}`);
    return { ...EMPTY, configured: true };
  }

  const rows = (data ?? []) as Row[];
  const translations = await translationsFor(
    db,
    rows.map((row) => String(row.id)),
  );
  const { url } = getSupabaseConfig();
  const total = count ?? 0;
  return {
    items: rows.map((row) => toItem(row, translations, url)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE)),
    configured: true,
  };
}

export async function getMediaItem(mediaId: string): Promise<MediaItem | null> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("media")
    .select("*")
    .eq("id", mediaId)
    .maybeSingle();
  if (!data) return null;
  const translations = await translationsFor(db, [mediaId]);
  const { url } = getSupabaseConfig();
  return toItem(data as Row, translations, url);
}

// ------------------------------------------------------------ references --

/**
 * Where a media item is currently used.
 *
 * `deleteRule` is the database's own behaviour if the row were ever hard
 * deleted, read from the live schema:
 *
 *   coffee_media.media_id            RESTRICT
 *   origin_media.media_id            RESTRICT
 *   articles.featured_media_id       SET NULL
 *   site_page_sections.media_id      SET NULL
 *   site_pages.og_media_id           SET NULL
 *   site_settings.org_logo_media_id  SET NULL
 *   site_settings.org_default_og_media_id SET NULL
 *
 * The Admin's archive is a soft delete (`media.deleted_at`), which no foreign
 * key can protect against — nothing at the database level stops an Admin
 * archiving an image the homepage hero depends on. That is exactly why the
 * warning is an application responsibility (FR-048).
 */
export type MediaReference = {
  kind:
    | "coffee"
    | "origin"
    | "article"
    | "cmsSection"
    | "pageOgImage"
    | "siteLogo"
    | "defaultOgImage";
  label: string;
  /** True where a hard delete would be refused by the database. */
  blocksDelete: boolean;
};

export async function findMediaReferences(
  mediaId: string,
): Promise<MediaReference[]> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();

  const [coffees, origins, articles, sections, pages, settings] =
    await Promise.all([
      db
        .from("coffee_media")
        .select("role,coffees(slug,deleted_at)")
        .eq("media_id", mediaId),
      db
        .from("origin_media")
        .select("role,origins(slug,deleted_at)")
        .eq("media_id", mediaId),
      db
        .from("articles")
        .select("id,status,article_translations(locale,title)")
        .eq("featured_media_id", mediaId),
      db
        .from("site_page_sections")
        .select("section_key,site_pages(page_key)")
        .eq("media_id", mediaId),
      db.from("site_pages").select("page_key").eq("og_media_id", mediaId),
      db
        .from("site_settings")
        .select("org_logo_media_id,org_default_og_media_id")
        .limit(1)
        .maybeSingle(),
    ]);

  const references: MediaReference[] = [];

  for (const row of coffees.data ?? []) {
    const coffee = row.coffees as unknown as {
      slug: string;
      deleted_at: string | null;
    } | null;
    references.push({
      kind: "coffee",
      label: `${coffee?.slug ?? "—"} · ${String(row.role)}`,
      blocksDelete: true,
    });
  }
  for (const row of origins.data ?? []) {
    const origin = row.origins as unknown as { slug: string } | null;
    references.push({
      kind: "origin",
      label: `${origin?.slug ?? "—"} · ${String(row.role)}`,
      blocksDelete: true,
    });
  }
  for (const row of articles.data ?? []) {
    const titles = (row.article_translations ?? []) as unknown as {
      locale: string;
      title: string;
    }[];
    const title =
      titles.find((t) => t.locale === "en")?.title ??
      titles[0]?.title ??
      String(row.id);
    references.push({
      kind: "article",
      label: `${title} · ${String(row.status)}`,
      blocksDelete: false,
    });
  }
  for (const row of sections.data ?? []) {
    const page = row.site_pages as unknown as { page_key: string } | null;
    references.push({
      kind: "cmsSection",
      label: `${page?.page_key ?? "—"} · ${String(row.section_key)}`,
      blocksDelete: false,
    });
  }
  for (const row of pages.data ?? [])
    references.push({
      kind: "pageOgImage",
      label: String(row.page_key),
      blocksDelete: false,
    });
  if (settings.data?.org_logo_media_id === mediaId)
    references.push({ kind: "siteLogo", label: "", blocksDelete: false });
  if (settings.data?.org_default_og_media_id === mediaId)
    references.push({ kind: "defaultOgImage", label: "", blocksDelete: false });

  return references;
}

/**
 * Whether the stored object actually exists.
 *
 * A row can outlive its object — a bucket cleaned by hand, a restore that
 * missed a file. The Admin should see that plainly instead of a broken image.
 */
export async function storageObjectExists(item: MediaItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const db = await createSupabaseServerClient();
  const lastSlash = item.storagePath.lastIndexOf("/");
  const folder = lastSlash > 0 ? item.storagePath.slice(0, lastSlash) : "";
  const name = item.storagePath.slice(lastSlash + 1);
  const { data, error } = await db.storage
    .from(MEDIA_BUCKET)
    .list(folder, { limit: 100, search: name });
  if (error) return false;
  return (data ?? []).some((object) => object.name === name);
}

/** Media that may be offered in the picker: usable, and never archived. */
export async function listPickableMedia(): Promise<MediaItem[]> {
  const page = await listMedia({ state: "active", page: 1 });
  // Without intrinsic dimensions nothing can render the item, so it is not
  // offered for selection rather than being selected and silently dropped.
  return page.items.filter((item) => item.width && item.height);
}
