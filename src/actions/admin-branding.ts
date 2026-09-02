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
 * The project logo relation (P8-T02).
 *
 * This writes `site_settings.org_logo_media_id` and nothing else. No new
 * column, no second logo table, no light/dark pair — the relation the schema
 * already has is the one used, and the existing official static asset remains
 * the fallback rather than a second stored row.
 *
 * Clearing the selection sets the relation back to NULL, which is what makes
 * the static artwork return. That path must keep working: it is the recovery
 * route when a chosen logo turns out to be wrong.
 */

export async function setSiteLogoAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");

  // "Use the official artwork" arrives as its own submitter rather than as an
  // empty `mediaId`, because the picker contributes a `mediaId` field of its
  // own and FormData would return that one instead.
  const clearing = formData.get("clearLogo") === "true";
  const parsed = z
    .object({
      mediaId: z.preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.string().uuid("invalidReference").nullable(),
      ),
    })
    .safeParse({ mediaId: clearing ? null : formData.get("mediaId") });
  if (!parsed.success)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { mediaId: ["invalidReference"] },
    });

  const db = await createSupabaseServerClient();
  const mediaId = parsed.data.mediaId;

  if (mediaId) {
    // The chosen item must be one that can actually be drawn: present, not
    // archived, public, and carrying intrinsic dimensions. Rejecting it here
    // means the Admin learns immediately, rather than saving successfully and
    // watching the static logo keep appearing with no explanation.
    const { data: media } = await db
      .from("media")
      .select("id,width,height,is_public")
      .eq("id", mediaId)
      .is("deleted_at", null)
      .eq("is_public", true)
      .maybeSingle();
    if (!media)
      return fail("VALIDATION", "checkHighlightedFields", {
        fieldErrors: { mediaId: ["mediaUnavailable"] },
      });
    if (!media.width || !media.height)
      return fail("VALIDATION", "checkHighlightedFields", {
        fieldErrors: { mediaId: ["imageDimensionsUnreadable"] },
      });
  }

  const { data: settings } = await db
    .from("site_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!settings) return fail("NOT_FOUND", "recordUnavailable");

  const { error } = await db
    .from("site_settings")
    .update({ org_logo_media_id: mediaId, updated_by: admin.id })
    .eq("id", settings.id);
  if (error) {
    console.error(`[admin-branding] logo save failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  // The mark is drawn in the root layout of every shell, so the whole tree is
  // revalidated: a saved logo that leaves stale chrome behind is not a save.
  revalidatePath("/", "layout");
  return ok(mediaId ? "logoUpdated" : "logoCleared");
}
