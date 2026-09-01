import type { InquiryStatus } from "@/lib/supabase/types.generated";

/**
 * The Lead Inbox's two status vocabularies, rendered once so the list and the
 * detail page can never disagree about what a status looks like.
 *
 * Colour is never the only carrier of meaning — every badge also states its
 * localized label as text (WCAG 1.4.1).
 */

const STATUS_TONE: Record<InquiryStatus, string> = {
  NEW: "border-gold/30 bg-gold/10 text-gold-deep dark:text-gold",
  RECEIVED: "border-border bg-muted text-muted-foreground",
  CONTACTED: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  SAMPLE_SENT:
    "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  DELIVERED:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CLOSED: "border-border bg-transparent text-muted-foreground",
};

export function StatusPill({
  status,
  label,
}: {
  status: InquiryStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
        STATUS_TONE[status] ?? STATUS_TONE.RECEIVED
      }`}
    >
      {label}
    </span>
  );
}

export function TypeBadge({ type, label }: { type: string; label: string }) {
  // A sample request carries an operational obligation a product inquiry does
  // not, so the two are distinguishable at a glance in a long list.
  const sample = type === "SAMPLE_REQUEST";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
        sample
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
