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
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Origin image management (finding N61).
 *
 * These actions only ever write `origin_media`. Media itself is created by the
 * shared pipeline through the Media Library and the reusable picker, so there
 * is no upload path here and no second implementation of one.
 *
 * The one difference from the Phase 6 coffee flow is deliberate: removing an
 * image here **unlinks it and stops**. A coffee image is created by and for
 * that coffee, so Phase 6 deletes the row with it; an origin image is chosen
 * from the shared library and may be the article's featured image or the site
 * logo as well. Deleting it would be destroying someone else's content — and
 * `origin_media.media_id` is ON DELETE RESTRICT precisely because the database
 * expects the link to be removed first.
 */

const UNIQUE_VIOLATION = "23505";

async function adminDb() {
  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");
  return { db: await createSupabaseServerClient() };
}

const isFailure = (value: unknown): value is ActionResult =>
  typeof value === "object" && value !== null && "ok" in value;

const uuid = z.string().trim().uuid("invalidReference");

const linkSchema = z.object({
  originId: uuid,
  mediaId: uuid,
  role: z.enum(["HERO", "GALLERY"], { message: "required" }),
});

/**
 * Links a library image to an origin.
 *
 * Promoting to HERO demotes the current one first: `origin_media_one_hero_image`
 * would otherwise reject the insert, and the Admin would see a failure for a
 * rule they were trying to satisfy.
 */
export async function attachOriginMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = linkSchema.safeParse({
    originId: formData.get("originId"),
    mediaId: formData.get("mediaId"),
    role: formData.get("role"),
  });
  if (!parsed.success)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { mediaId: ["mediaRequired"] },
    });

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const { originId, mediaId, role } = parsed.data;

  // Both references are verified server-side; a well-formed uuid is not
  // evidence that the row exists or may be used.
  const [origin, media] = await Promise.all([
    db
      .from("origins")
      .select("id")
      .eq("id", originId)
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("media")
      .select("id,width,height")
      .eq("id", mediaId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (!origin.data) return fail("NOT_FOUND", "recordUnavailable");
  if (!media.data)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { mediaId: ["mediaUnavailable"] },
    });
  if (!media.data.width || !media.data.height)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { mediaId: ["imageDimensionsUnreadable"] },
    });

  const { data: existing } = await db
    .from("origin_media")
    .select("media_id,role,sort_order")
    .eq("origin_id", originId);
  const links = existing ?? [];

  if (links.some((row) => String(row.media_id) === mediaId))
    return fail("CONFLICT", "checkHighlightedFields", {
      fieldErrors: { mediaId: ["mediaAlreadyLinked"] },
    });

  if (role === "HERO") {
    const currentHero = links.find((row) => String(row.role) === "HERO");
    if (currentHero) {
      const demote = await db
        .from("origin_media")
        .update({
          role: "GALLERY",
          sort_order:
            Math.max(0, ...links.map((row) => Number(row.sort_order) || 0)) + 1,
        })
        .eq("origin_id", originId)
        .eq("media_id", currentHero.media_id);
      if (demote.error) {
        console.error(`[origin-media] demote failed: ${demote.error.code}`);
        return fail("UNEXPECTED", "saveFailed");
      }
    }
  }

  const nextOrder =
    role === "HERO"
      ? 0
      : Math.max(0, ...links.map((row) => Number(row.sort_order) || 0)) + 1;

  const { error } = await db.from("origin_media").insert({
    origin_id: originId,
    media_id: mediaId,
    role,
    sort_order: nextOrder,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      return fail("CONFLICT", "checkHighlightedFields", {
        fieldErrors: { mediaId: ["mediaAlreadyLinked"] },
      });
    console.error(`[origin-media] attach failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok(role === "HERO" ? "heroImageSet" : "imagesAttached");
}

/** Promotes an already-linked gallery image to HERO. */
export async function setOriginHeroAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z.object({ originId: uuid, mediaId: uuid }).safeParse({
    originId: formData.get("originId"),
    mediaId: formData.get("mediaId"),
  });
  if (!parsed.success) return fail("VALIDATION", "invalidReference");

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const { originId, mediaId } = parsed.data;

  const { data: links } = await db
    .from("origin_media")
    .select("media_id,role,sort_order")
    .eq("origin_id", originId);
  const rows = links ?? [];
  const target = rows.find((row) => String(row.media_id) === mediaId);
  if (!target) return fail("NOT_FOUND", "mediaUnavailable");
  if (String(target.role) === "HERO") return ok("heroImageSet");

  // Demote before promoting: the partial unique index permits one HERO at a
  // time, so the reverse order would be rejected.
  const currentHero = rows.find((row) => String(row.role) === "HERO");
  if (currentHero) {
    const demote = await db
      .from("origin_media")
      .update({
        role: "GALLERY",
        sort_order:
          Math.max(0, ...rows.map((row) => Number(row.sort_order) || 0)) + 1,
      })
      .eq("origin_id", originId)
      .eq("media_id", currentHero.media_id);
    if (demote.error) {
      console.error(`[origin-media] demote failed: ${demote.error.code}`);
      return fail("UNEXPECTED", "saveFailed");
    }
  }

  const promote = await db
    .from("origin_media")
    .update({ role: "HERO", sort_order: 0 })
    .eq("origin_id", originId)
    .eq("media_id", mediaId);
  if (promote.error) {
    console.error(`[origin-media] promote failed: ${promote.error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok("heroImageSet");
}

/**
 * Unlinks an image from an origin.
 *
 * The media row and its storage object are left alone — see the note at the
 * top of this file. If the removed image was the hero, the first remaining
 * gallery image takes its place so the origin does not silently lose one.
 */
export async function removeOriginMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z.object({ originId: uuid, mediaId: uuid }).safeParse({
    originId: formData.get("originId"),
    mediaId: formData.get("mediaId"),
  });
  if (!parsed.success) return fail("VALIDATION", "invalidReference");

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const { originId, mediaId } = parsed.data;

  const { data: link } = await db
    .from("origin_media")
    .select("role")
    .eq("origin_id", originId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (!link) return fail("NOT_FOUND", "mediaUnavailable");

  const { error } = await db
    .from("origin_media")
    .delete()
    .eq("origin_id", originId)
    .eq("media_id", mediaId);
  if (error) {
    console.error(`[origin-media] remove failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  if (String(link.role) === "HERO") {
    const { data: remaining } = await db
      .from("origin_media")
      .select("media_id")
      .eq("origin_id", originId)
      .order("sort_order")
      .limit(1);
    const promote = remaining?.[0];
    if (promote)
      await db
        .from("origin_media")
        .update({ role: "HERO", sort_order: 0 })
        .eq("origin_id", originId)
        .eq("media_id", promote.media_id);
  }

  revalidatePath("/", "layout");
  return ok("imageRemoved");
}

/** Reorders the gallery. The hero keeps `sort_order` 0 and is not moved. */
export async function reorderOriginMediaAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const originId = uuid.safeParse(formData.get("originId"));
  if (!originId.success) return fail("VALIDATION", "invalidReference");

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const order = formData
    .getAll("order")
    .map((value) => String(value))
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));

  const { data: rows } = await db
    .from("origin_media")
    .select("media_id,role")
    .eq("origin_id", originId.data);
  const known = new Map(
    (rows ?? []).map((row) => [String(row.media_id), String(row.role)]),
  );

  let position = 1;
  for (const mediaId of order) {
    // Only ids already linked to this origin are touched, and never the hero.
    if (known.get(mediaId) !== "GALLERY") continue;
    await db
      .from("origin_media")
      .update({ sort_order: position })
      .eq("origin_id", originId.data)
      .eq("media_id", mediaId);
    position += 1;
  }

  revalidatePath("/", "layout");
  return ok("imagesReordered");
}
