"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { archiveAdminRecordAction } from "@/actions/admin-operations";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { idleActionState, settled } from "@/lib/actions";

/**
 * Archiving one reference record.
 *
 * Two things this replaces. The previous control submitted immediately, with
 * no confirmation at all — one mis-click retired a warehouse an offer depended
 * on. And its label came from a hardcoded English string, so the Arabic Admin
 * read "Archive" in English.
 *
 * The dialog names the record and says what archiving actually does, rather
 * than asking "Are you sure?" about something unidentified (§27).
 */
export function AdminArchiveAction({
  id,
  entity,
  recordName,
}: {
  id: string;
  entity: string;
  /** Shown in the dialog so the Admin can see what they are retiring. */
  recordName: string;
}) {
  const t = useTranslations("admin.modules");
  const responses = useTranslations("admin.responses");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    archiveAdminRecordAction,
    idleActionState,
  );
  const outcome = settled(state);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold transition hover:border-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {t("archive")}
      </button>

      {outcome && !outcome.ok ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {responses(outcome.messageKey as Parameters<typeof responses>[0])}
        </span>
      ) : null}

      <ConfirmDialog
        open={open}
        title={t("archiveTitle")}
        description={t("archiveBody", { record: recordName })}
        confirmLabel={t("archive")}
        cancelLabel={t("cancel")}
        onCancel={() => setOpen(false)}
      >
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="entity" value={entity} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-bold text-destructive-foreground disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t("archive")}
          </button>
        </form>
      </ConfirmDialog>
    </>
  );
}
