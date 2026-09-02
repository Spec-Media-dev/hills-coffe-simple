"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { findMediaReferences } from "@/lib/data/media-library";
import {
  isRejection,
  saveMediaTranslations,
  storeImage,
} from "@/lib/media/upload";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Media Library write paths (P8-T03).
 *
 * Every action re-checks `requireAdmin()` — a hidden button is not a boundary,
 * and a server action is a public endpoint. None of them returns provider
 * text: results carry a message key the client resolves in its own locale.
 *
 * The upload itself is `lib/media/upload.ts`, shared with the Phase 6 coffee
 * pipeline, so magic-byte sniffing, size limits, the server-chosen path,
 * intrinsic dimensions and orphan cleanup are one implementation.
 */

/** `foreign_key_violation` — raised by the RESTRICT consumers on hard delete. */
const FK_VIOLATION = "23503";

async function adminDb() {
  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");
  return { db: await createSupabaseServerClient(), adminId: admin.id };
}

const isFailure = (value: unknown): value is ActionResult =>
  typeof value === "object" && value !== null && "ok" in value;

const altText = z
  .string()
  .trim()
  .max(500, "tooLong")
  .optional()
  .transform((value) => value ?? "");

const caption = z
  .string()
  .trim()
  .max(1000, "tooLong")
  .optional()
  .transform((value) => value ?? "");

export type UploadedMedia = { mediaId: string };

/**
 * Uploads one image into the library.
 *
 * English alt text is required: an image with no accessible name is one a
 * screen-reader user cannot use, and the public renderer has no honest way to
 * invent one. Arabic alt text is optional here and surfaced to the Admin as a
 * warning instead — a missing translation must stay visible rather than being
 * fabricated (FR-049).
 */
export async function uploadMediaAction(
  _state: ActionFormState<UploadedMedia>,
  formData: FormData,
): Promise<ActionResult<UploadedMedia>> {
  const context = await adminDb();
  if (isFailure(context)) return context as ActionResult<UploadedMedia>;
  const { db, adminId } = context;

  const parsed = z
    .object({
      altEn: altText,
      altAr: altText,
      captionEn: caption,
      captionAr: caption,
    })
    .safeParse({
      altEn: formData.get("altEn") ?? "",
      altAr: formData.get("altAr") ?? "",
      captionEn: formData.get("captionEn") ?? "",
      captionAr: formData.get("captionAr") ?? "",
    });
  if (!parsed.success)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { altEn: ["tooLong"] },
    });
  if (!parsed.data.altEn)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { altEn: ["altTextRequired"] },
    });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { file: ["imageRequired"] },
    });

  const stored = await storeImage(db, {
    file,
    folder: "media",
    uploadedBy: adminId,
  });
  if (isRejection(stored))
    return fail("STORAGE_INVALID", "checkHighlightedFields", {
      fieldErrors: { file: [stored.rejected] },
    });

  const translations = await saveMediaTranslations(
    db,
    stored.mediaId,
    parsed.data,
  );
  if (translations.error) {
    // The alt text is part of what makes the item usable, so a half-saved
    // item is rolled back rather than left in the library incomplete.
    await db.from("media").delete().eq("id", stored.mediaId);
    await db.storage.from("hills-public").remove([stored.storagePath]);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok<UploadedMedia>("mediaUploaded", { mediaId: stored.mediaId });
}

export async function updateMediaTranslationsAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const parsed = z
    .object({
      mediaId: z.string().trim().uuid("invalidReference"),
      altEn: altText,
      altAr: altText,
      captionEn: caption,
      captionAr: caption,
    })
    .safeParse({
      mediaId: formData.get("mediaId"),
      altEn: formData.get("altEn") ?? "",
      altAr: formData.get("altAr") ?? "",
      captionEn: formData.get("captionEn") ?? "",
      captionAr: formData.get("captionAr") ?? "",
    });
  if (!parsed.success)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { altEn: ["invalidValue"] },
    });
  if (!parsed.data.altEn)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { altEn: ["altTextRequired"] },
    });

  const { error } = await saveMediaTranslations(
    db,
    parsed.data.mediaId,
    parsed.data,
  );
  if (error) {
    console.error(`[admin-media] translations failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  revalidatePath("/", "layout");
  return ok("mediaTranslationsSaved");
}

export type ArchiveConflict = { references: number };

/**
 * Archives a media item, refusing the first attempt when it is still in use.
 *
 * Archiving is a soft delete, so no foreign key stands in the way: the
 * database would let an Admin retire the image the homepage hero renders and
 * say nothing. The refusal is therefore issued here, and cleared only by an
 * explicit confirmation that names how many places are affected.
 */
export async function archiveMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const parsed = z
    .object({
      mediaId: z.string().trim().uuid("invalidReference"),
      confirmed: z.enum(["true", "false"]).default("false"),
    })
    .safeParse({
      mediaId: formData.get("mediaId"),
      confirmed: formData.get("confirmed") ?? "false",
    });
  if (!parsed.success) return fail("VALIDATION", "invalidReference");

  const references = await findMediaReferences(parsed.data.mediaId);
  if (references.length && parsed.data.confirmed !== "true")
    return fail("CONFLICT", "mediaStillReferenced", {
      conflict: { requestCode: String(references.length) },
    });

  const { error, data } = await db
    .from("media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.mediaId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    console.error(`[admin-media] archive failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  if (!data?.length) return fail("NOT_FOUND", "mediaUnavailable");

  revalidatePath("/", "layout");
  return ok("mediaArchived");
}

export async function restoreMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const mediaId = z.string().trim().uuid().safeParse(formData.get("mediaId"));
  if (!mediaId.success) return fail("VALIDATION", "invalidReference");

  const { error, data } = await db
    .from("media")
    .update({ deleted_at: null })
    .eq("id", mediaId.data)
    .select("id");
  if (error) {
    console.error(`[admin-media] restore failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  if (!data?.length) return fail("NOT_FOUND", "mediaUnavailable");
  revalidatePath("/", "layout");
  return ok("mediaRestored");
}

/**
 * Permanently removes an archived item and its stored object.
 *
 * `coffee_media` and `origin_media` reference media with ON DELETE RESTRICT,
 * so the database refuses this while a coffee or origin still points at it.
 * That refusal arrives as SQLSTATE 23503 and is translated here — the
 * constraint name never reaches the Admin.
 */
export async function deleteMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const mediaId = z.string().trim().uuid().safeParse(formData.get("mediaId"));
  if (!mediaId.success) return fail("VALIDATION", "invalidReference");

  const { data: row } = await db
    .from("media")
    .select("storage_bucket,storage_path,deleted_at")
    .eq("id", mediaId.data)
    .maybeSingle();
  if (!row) return fail("NOT_FOUND", "mediaUnavailable");
  // Deleting is only ever a second step after archiving, so an item cannot be
  // destroyed straight from the library grid by one mis-click.
  if (!row.deleted_at) return fail("CONFLICT", "archiveBeforeDeleting");

  const { error } = await db.from("media").delete().eq("id", mediaId.data);
  if (error) {
    if (error.code === FK_VIOLATION)
      return fail("CONFLICT", "mediaStillReferenced");
    console.error(`[admin-media] delete failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  // The row is gone; remove the object so the bucket does not accumulate
  // files nothing can reach.
  await db.storage
    .from(String(row.storage_bucket))
    .remove([String(row.storage_path)]);

  revalidatePath("/", "layout");
  return ok("mediaDeleted");
}
