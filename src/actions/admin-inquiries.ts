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
 * P7-T02 — Admin status transitions, arbitrated by the database.
 *
 * `validate_inquiry_status_transition()` is a `BEFORE UPDATE OF status`
 * trigger and is the **sole** authority on which transitions are legal. This
 * action therefore does not carry a copy of the transition graph: it attempts
 * the write and translates the rejection. Duplicating the graph here would
 * create a second definition that can silently drift from the one that
 * actually enforces the rule.
 *
 * `track_inquiry_status()` is likewise the sole writer of
 * `inquiry_status_history`, on both INSERT and UPDATE OF status. This action
 * must never insert a history row itself — doing so would double-count every
 * transition.
 */

/** `check_violation`, which the transition trigger raises. */
const CHECK_VIOLATION = "23514";

/**
 * The messages the trigger raises. They are matched here only to confirm the
 * rejection came from the transition rule; none of this text ever reaches the
 * client, which receives a message key instead.
 */
const TRANSITION_REJECTIONS = [
  "invalid_inquiry_status_transition",
  "invalid_sample_request_status_transition",
  "sample_status_not_allowed_for_inquiry_type",
];

const schema = z.object({
  inquiryId: z.string().trim().uuid("invalidReference"),
  status: z.enum(
    ["NEW", "RECEIVED", "CONTACTED", "SAMPLE_SENT", "DELIVERED", "CLOSED"],
    { message: "required" },
  ),
  /**
   * The status the Admin's page was rendered with. If the row has since moved
   * on, the update is refused rather than silently overwriting someone else's
   * newer state.
   */
  expectedStatus: z
    .enum([
      "NEW",
      "RECEIVED",
      "CONTACTED",
      "SAMPLE_SENT",
      "DELIVERED",
      "CLOSED",
    ])
    .optional(),
});

export async function updateInquiryStatusAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    inquiryId: formData.get("inquiryId"),
    status: formData.get("status"),
    expectedStatus: formData.get("expectedStatus") || undefined,
  });
  if (!parsed.success)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: { status: ["required"] },
    });

  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");

  const db = await createSupabaseServerClient();
  const { inquiryId, status, expectedStatus } = parsed.data;

  // Optimistic concurrency: scope the update to the status the Admin saw. A
  // stale page therefore updates zero rows instead of clobbering a newer one.
  let update = db.from("inquiries").update({ status }).eq("id", inquiryId);
  if (expectedStatus) update = update.eq("status", expectedStatus);

  const { data, error } = await update.select("id,status");

  if (error) {
    if (
      error.code === CHECK_VIOLATION &&
      TRANSITION_REJECTIONS.some((message) =>
        `${error.message} ${error.details ?? ""}`.includes(message),
      )
    )
      return fail("CONFLICT", "statusTransitionRejected");
    console.error(`[admin-inquiries] status update failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  // Zero rows means the row is gone, or its status moved since the page
  // rendered. Both are conflicts from the Admin's point of view, and neither
  // reveals anything about the row.
  if (!data || data.length === 0)
    return fail("CONFLICT", "statusTransitionRejected");

  revalidatePath("/", "layout");
  return ok("statusUpdated");
}
