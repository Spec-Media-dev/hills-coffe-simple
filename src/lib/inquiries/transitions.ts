import type { InquiryStatus } from "@/lib/supabase/types.generated";

/**
 * Which transitions are worth *offering* for a given inquiry type and status.
 *
 * This is presentation only. `validate_inquiry_status_transition()` remains the
 * sole authority on legality, and `updateInquiryStatusAction` maps its
 * rejection to `CONFLICT`; nothing here is trusted at write time. Its purpose
 * is narrower: a free dropdown of all six statuses would invite an Admin to
 * pick a transition the database will refuse, so the Admin sees only the
 * actions that make sense from where the request currently stands.
 *
 * It lives outside the `"use server"` action module because every export of a
 * server-action file must be an async server function.
 */
export function allowedNextStatuses(
  type: string,
  current: InquiryStatus,
): InquiryStatus[] {
  if (current === "CLOSED") return [];
  const graph: Record<string, Partial<Record<string, InquiryStatus[]>>> = {
    SAMPLE_REQUEST: {
      NEW: ["RECEIVED", "CLOSED"],
      RECEIVED: ["CONTACTED", "CLOSED"],
      CONTACTED: ["SAMPLE_SENT", "CLOSED"],
      SAMPLE_SENT: ["DELIVERED", "CLOSED"],
      DELIVERED: ["CLOSED"],
    },
    // PRODUCT and GENERAL never reach the sample-only statuses; the trigger
    // rejects `sample_status_not_allowed_for_inquiry_type` if one is tried.
    OTHER: {
      NEW: ["RECEIVED", "CLOSED"],
      RECEIVED: ["CONTACTED", "CLOSED"],
      CONTACTED: ["CLOSED"],
    },
  };
  const table = type === "SAMPLE_REQUEST" ? graph.SAMPLE_REQUEST : graph.OTHER;
  return table[current] ?? [];
}
