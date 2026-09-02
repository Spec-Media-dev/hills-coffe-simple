import "server-only";
import { sniffImageType } from "@/lib/avatar";
import { readImageDimensions } from "./dimensions";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one secure image-ingest pipeline for business media.
 *
 * Phase 6 proved this sequence for coffee images; Phase 8 needs the identical
 * guarantees for the Media Library, articles, CMS sections and the site logo.
 * Writing it once means a future weakening has one place to happen and one
 * place to be caught, rather than five upload paths drifting apart.
 *
 * What it guarantees, in order:
 *
 *  1. **Size before bytes.** An oversized file is refused before it is read
 *     into memory.
 *  2. **Signature over declaration.** `file.type` is attacker-controlled, so
 *     the real magic bytes must agree with it. A script renamed `.png`, an SVG,
 *     or a PNG announced as JPEG is refused (FR-019).
 *  3. **Intrinsic dimensions are recorded.** `media.width`/`height` are what
 *     `next/image` needs to reserve layout space; a row without them cannot be
 *     rendered by the public CMS at all.
 *  4. **The server chooses the path.** The original filename is never used —
 *     not as a path, not as a segment, not as an extension.
 *  5. **No orphans in either direction.** If the row fails, the object is
 *     removed; the caller can undo both with `rollbackStoredImage` if its own
 *     linking step then fails.
 *
 * `is_public` is left at its column default: this bucket is the public one, and
 * nothing here decides visibility policy.
 */

export const MEDIA_BUCKET = "hills-public";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/** Message keys, resolved by the client in its own locale. Never prose. */
export type UploadRejection =
  | "imageRequired"
  | "imageTooLarge"
  | "imageTypeInvalid"
  | "imageDimensionsUnreadable"
  | "uploadFailed";

export type StoredImage = {
  mediaId: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

type Db = SupabaseClient;

/**
 * Validates, stores and records one image.
 *
 * `folder` is a server-chosen prefix (`media`, `coffees/<id>`, …). It is never
 * derived from client input beyond an id the caller has already verified.
 */
export async function storeImage(
  db: Db,
  {
    file,
    folder,
    uploadedBy,
  }: { file: File; folder: string; uploadedBy: string | null },
): Promise<StoredImage | { rejected: UploadRejection }> {
  if (!(file instanceof File) || file.size <= 0)
    return { rejected: "imageRequired" };
  if (file.size > MAX_IMAGE_BYTES) return { rejected: "imageTooLarge" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed || sniffed !== file.type)
    return { rejected: "imageTypeInvalid" };

  // An image whose header cannot be read is refused rather than stored without
  // dimensions: a row missing them is invisible to every renderer, which is a
  // silent failure the Admin would have no way to diagnose.
  const size = readImageDimensions(bytes, sniffed);
  if (!size) return { rejected: "imageDimensionsUnreadable" };

  const storagePath = `${folder}/${crypto.randomUUID()}.${EXTENSION[sniffed]}`;
  const upload = await db.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: sniffed, upsert: false });
  if (upload.error) return { rejected: "uploadFailed" };

  const media = await db
    .from("media")
    .insert({
      storage_bucket: MEDIA_BUCKET,
      storage_path: storagePath,
      mime_type: sniffed,
      width: size.width,
      height: size.height,
      file_size_bytes: file.size,
      is_public: true,
      uploaded_by: uploadedBy,
    })
    .select("id")
    .single();

  if (media.error || !media.data) {
    // The object exists but nothing references it: remove it now.
    await db.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return { rejected: "uploadFailed" };
  }

  return {
    mediaId: String(media.data.id),
    storagePath,
    mimeType: sniffed,
    width: size.width,
    height: size.height,
    sizeBytes: file.size,
  };
}

export const isRejection = (
  value: StoredImage | { rejected: UploadRejection },
): value is { rejected: UploadRejection } => "rejected" in value;

/**
 * Undoes a `storeImage` when the caller's own follow-up write fails, so a
 * half-finished attach leaves neither a stray object nor a stray row.
 */
export async function rollbackStoredImage(db: Db, stored: StoredImage) {
  await db.from("media").delete().eq("id", stored.mediaId);
  await db.storage.from(MEDIA_BUCKET).remove([stored.storagePath]);
}

/**
 * Writes alt text and captions for a media item.
 *
 * A blank value is stored as NULL, never as an empty string: "no Arabic alt
 * text yet" must stay distinguishable from "deliberately empty", because the
 * Admin surfaces the difference and the public renderer falls back on it.
 */
export async function saveMediaTranslations(
  db: Db,
  mediaId: string,
  values: {
    altEn?: string | null;
    altAr?: string | null;
    captionEn?: string | null;
    captionAr?: string | null;
  },
) {
  const blankToNull = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  return db.from("media_translations").upsert(
    [
      {
        media_id: mediaId,
        locale: "en",
        alt_text: blankToNull(values.altEn),
        caption: blankToNull(values.captionEn),
      },
      {
        media_id: mediaId,
        locale: "ar",
        alt_text: blankToNull(values.altAr),
        caption: blankToNull(values.captionAr),
      },
    ],
    { onConflict: "media_id,locale" },
  );
}
