"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateInquiryStatusAction } from "@/actions/admin-inquiries";
import { idleActionState, settled } from "@/lib/actions";
import type { InquiryStatus } from "@/lib/supabase/types.generated";

/**
 * The Admin's status controls for one request (P7-T02 / §9).
 *
 * Two properties matter here:
 *
 *  - **Only sensible actions are offered.** `allowedNextStatuses` decided the
 *    buttons on the server; there is no free dropdown of all six statuses that
 *    would let an Admin pick a transition the database will refuse.
 *  - **A stale page cannot overwrite newer state.** `expectedStatus` is the
 *    status this page was rendered with, and the action scopes its UPDATE to
 *    it. If someone else moved the request meanwhile, the write matches zero
 *    rows and comes back as a conflict rather than silently winning.
 *
 * The database remains the authority either way: a transition this component
 * offers can still be rejected, and that rejection is what the Admin sees.
 */

const ACTION_KEYS: Record<InquiryStatus, string> = {
  NEW: "markReceived",
  RECEIVED: "markReceived",
  CONTACTED: "markContacted",
  SAMPLE_SENT: "markSampleSent",
  DELIVERED: "markDelivered",
  CLOSED: "markClosed",
};

export function LeadStatusActions({
  inquiryId,
  currentStatus,
  options,
}: {
  inquiryId: string;
  currentStatus: InquiryStatus;
  options: InquiryStatus[];
}) {
  const t = useTranslations("admin.leads");
  const responses = useTranslations("admin.responses");
  const [state, action, pending] = useActionState(
    updateInquiryStatusAction,
    idleActionState,
  );
  const outcome = settled(state);
  const copy = (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";

  // The outcome is rendered outside the action list, never inside it. The last
  // legal transition empties `options` on the re-render that follows it, so a
  // message nested among the buttons would vanish at exactly the moment it
  // mattered most — the Administrator would close a request and be told
  // nothing.
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="expectedStatus" value={currentStatus} />

      {options.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          {t("noActions")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((next) => (
            // The chosen status travels as the submitter's own value, so one
            // form serves every action without a hidden radio group.
            <button
              key={next}
              type="submit"
              name="status"
              value={next}
              disabled={pending}
              aria-busy={pending}
              className={`inline-flex h-11 min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:opacity-60 ${
                next === "CLOSED"
                  ? "border border-border bg-card hover:border-gold"
                  : "bg-primary text-primary-foreground hover:bg-forest-light"
              }`}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t(ACTION_KEYS[next] as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      )}

      {outcome && !outcome.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}
      {outcome?.ok ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}
    </form>
  );
}
