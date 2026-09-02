import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { isSupabaseConfigured, getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storagePublicUrl } from "./shared";

/**
 * Origin images, on the existing `origins → origin_media → media` relation
 * (finding N61).
 *
 * The live contract mirrors `coffee_media` exactly:
 *
 *   origin_media_pkey            PRIMARY KEY (origin_id, media_id)
 *   origin_media_one_hero_image  UNIQUE (origin_id) WHERE role = 'HERO'
 *   origin_media_role            CHECK (role IN ('HERO','GALLERY'))
 *   media_id                     REFERENCES media(id) ON DELETE RESTRICT
 *   origin_id                    REFERENCES origins(id) ON DELETE CASCADE
 *
 * So "exactly one hero" is a database guarantee, not an application
 * convention, and the application's job is to promote in an order the index
 * accepts.
 *
 * No column is added to `origins`; nothing here creates media.
 */

export type OriginImage = {
  mediaId: string;
  role: "HERO" | "GALLERY";
  sortOrder: number;
  url: string;
  width: number | null;
  height: number | null;
  altEn: string | null;
  altAr: string | null;
  archived: boolean;
};

export async function getOriginImages(
  originId: string,
): Promise<OriginImage[]> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();

  const { data: links } = await db
    .from("origin_media")
    .select("media_id,role,sort_order")
    .eq("origin_id", originId)
    .order("sort_order");
  if (!links?.length) return [];

  const mediaIds = links.map((row) => String(row.media_id));
  const [mediaQ, translationsQ] = await Promise.all([
    db
      .from("media")
      .select("id,storage_bucket,storage_path,width,height,deleted_at")
      .in("id", mediaIds),
    db
      .from("media_translations")
      .select("media_id,locale,alt_text")
      .in("media_id", mediaIds),
  ]);

  const { url } = getSupabaseConfig();
  const media = new Map(
    (mediaQ.data ?? []).map((row) => [String(row.id), row]),
  );

  return links.flatMap((link) => {
    const row = media.get(String(link.media_id));
    if (!row) return [];
    const translations = (translationsQ.data ?? []).filter(
      (t) => String(t.media_id) === String(link.media_id),
    );
    const alt = (locale: string) =>
      translations.find((t) => String(t.locale) === locale)?.alt_text ?? null;
    return [
      {
        mediaId: String(link.media_id),
        role: String(link.role) as "HERO" | "GALLERY",
        sortOrder: Number(link.sort_order ?? 0),
        url: storagePublicUrl(url, row.storage_bucket, row.storage_path),
        width: row.width === null ? null : Number(row.width),
        height: row.height === null ? null : Number(row.height),
        altEn: alt("en") ? String(alt("en")) : null,
        altAr: alt("ar") ? String(alt("ar")) : null,
        // Surfaced rather than hidden: an archived item is still linked, and
        // the Admin should see why it stopped appearing publicly.
        archived: Boolean(row.deleted_at),
      },
    ];
  });
}
