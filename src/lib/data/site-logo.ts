import "server-only";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storagePublicUrl } from "./shared";

/**
 * P8-T02 — the project logo, resolved from `site_settings.org_logo_media_id`.
 *
 * The relation has existed since the schema was created and nothing consumed
 * it: `BrandMark` rendered a hardcoded file, so choosing a logo in the Admin
 * changed nothing anywhere (finding N53).
 *
 * The single rule here is that **this function may never be the reason a logo
 * disappears**. Every failure — no settings row, a NULL relation, an archived
 * media row, a non-public one, missing dimensions, an unreadable response —
 * returns `null`, and `BrandMark` then draws the official static asset. A
 * missing logo is a far worse outcome than a stale one.
 *
 * `cache()` deduplicates the read within a single render, so a page drawing
 * the mark in its header, its footer and its mobile menu still costs one
 * round trip.
 */

export type SiteLogo = {
  url: string;
  width: number;
  height: number;
  /** Alt text from `media_translations`, or null to keep the caller's label. */
  alt: string | null;
};

export const getSiteLogo = cache(
  async (locale: Locale): Promise<SiteLogo | null> => {
    if (!isSupabaseConfigured()) return null;
    try {
      const db = await createSupabaseServerClient();
      const { data: settings } = await db
        .from("site_settings")
        .select("org_logo_media_id")
        .limit(1)
        .maybeSingle();
      const mediaId = settings?.org_logo_media_id;
      if (!mediaId) return null;

      const { data: media } = await db
        .from("media")
        .select("storage_bucket,storage_path,width,height,is_public,deleted_at")
        .eq("id", mediaId)
        // Archived or non-public media is not a usable logo. Both are checked
        // here rather than assumed from the relation, because the foreign key
        // is ON DELETE SET NULL and says nothing about either state.
        .is("deleted_at", null)
        .eq("is_public", true)
        .maybeSingle();
      // Without intrinsic dimensions the mark cannot be laid out without
      // shifting the header, so the static asset is the better answer.
      if (!media?.width || !media.height) return null;

      const { data: translations } = await db
        .from("media_translations")
        .select("locale,alt_text")
        .eq("media_id", mediaId);
      const alt =
        (translations ?? []).find((row) => row.locale === locale)?.alt_text ??
        (translations ?? []).find((row) => row.locale === "en")?.alt_text ??
        null;

      const { url } = getSupabaseConfig();
      return {
        url: storagePublicUrl(url, media.storage_bucket, media.storage_path),
        width: Number(media.width),
        height: Number(media.height),
        alt: alt ? String(alt) : null,
      };
    } catch (error) {
      // Never surfaced: the brand mark falls back and the page renders.
      console.error(
        `[site-logo] resolution failed: ${
          error instanceof Error ? error.name : "unknown"
        }`,
      );
      return null;
    }
  },
);
