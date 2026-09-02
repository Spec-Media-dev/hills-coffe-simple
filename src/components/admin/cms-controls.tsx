"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { deleteSectionAction, setPageStatusAction } from "@/actions/admin-cms";
import { idleActionState, settled } from "@/lib/actions";

/**
 * Publish controls and section removal.
 *
 * Only the transitions that make sense from where the page stands are offered,
 * the same principle the Lead Inbox uses: a draft can be published or
 * archived, a live page can be taken down or archived, and an archived page
 * can come back as a draft.
 */

const useCopy = () => {
  const responses = useTranslations("admin.responses");
  return (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";
};

export function PageStatusControls({
  pageId,
  status,
  labels,
}: {
  pageId: string;
  status: string;
  labels: { publish: string; unpublish: string; archive: string };
}) {
  const copy = useCopy();
  const [state, action, pending] = useActionState(
    setPageStatusAction,
    idleActionState,
  );
  const outcome = settled(state);

  const options: { value: string; label: string; tone: "primary" | "muted" }[] =
    status === "PUBLISHED"
      ? [
          { value: "DRAFT", label: labels.unpublish, tone: "muted" },
          { value: "ARCHIVED", label: labels.archive, tone: "muted" },
        ]
      : status === "ARCHIVED"
        ? [{ value: "DRAFT", label: labels.unpublish, tone: "primary" }]
        : [
            { value: "PUBLISHED", label: labels.publish, tone: "primary" },
            { value: "ARCHIVED", label: labels.archive, tone: "muted" },
          ];

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={pageId} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="submit"
            name="status"
            value={option.value}
            disabled={pending}
            aria-busy={pending}
            className={`inline-flex h-11 min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:opacity-60 ${
              option.tone === "primary"
                ? "bg-primary text-primary-foreground hover:bg-forest-light"
                : "border border-border hover:border-gold"
            }`}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {option.label}
          </button>
        ))}
      </div>
      {outcome ? (
        <p
          role={outcome.ok ? "status" : "alert"}
          className={`rounded-xl p-3 text-sm ${
            outcome.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}
    </form>
  );
}

export function SectionRemove({
  sectionId,
  label,
}: {
  sectionId: string;
  label: string;
}) {
  const copy = useCopy();
  const [state, action, pending] = useActionState(
    deleteSectionAction,
    idleActionState,
  );
  const outcome = settled(state);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={sectionId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-bold transition hover:border-destructive hover:text-destructive disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {label}
      </button>
      {outcome && !outcome.ok ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {copy(outcome.messageKey)}
        </span>
      ) : null}
    </form>
  );
}
