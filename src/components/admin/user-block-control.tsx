"use client";

import { Loader2, ShieldBan, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  setUserBlockedAction,
  type BlockActionData,
} from "@/actions/admin-users";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { idleActionState, settled, type ActionFormState } from "@/lib/actions";

/**
 * Block / unblock control for one customer.
 *
 * Reuses Phase 4's `ConfirmDialog` rather than growing a second modal, so the
 * focus trap, Escape handling and RTL button order are the ones already
 * verified there.
 *
 * The block reason is collected only when blocking. It is internal and
 * Admin-only — it is never rendered anywhere a customer can reach.
 */
export function UserBlockControl({
  userId,
  isBlocked,
  customerName,
}: {
  userId: string;
  isBlocked: boolean;
  customerName: string;
}) {
  const t = useTranslations("admin.users");
  const responses = useTranslations("admin.responses");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    setUserBlockedAction,
    idleActionState as ActionFormState<BlockActionData>,
  );

  // Closing the dialog is derived from the action settling, adjusted during
  // render rather than in an effect, so it does not trigger a cascading render.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (settled(state)?.messageKey) setOpen(false);
  }

  // The toast is a genuine external system, so it stays in an effect.
  useEffect(() => {
    const outcome = settled(state);
    if (!outcome?.messageKey) return;
    const message = responses(
      outcome.messageKey as Parameters<typeof responses>[0],
    );
    // A durable block whose Auth-layer sync did not land is a success with a
    // warning, never an error: the block itself is in force.
    if (outcome.ok && outcome.data?.authSyncPending) toast.warning(message);
    else if (outcome.ok) toast.success(message);
    else toast.error(message);
  }, [state, responses]);

  const action = isBlocked ? "unblock" : "block";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition ${
          isBlocked
            ? "border border-border bg-card hover:border-gold"
            : "bg-destructive text-white hover:opacity-90"
        }`}
      >
        {isBlocked ? (
          <ShieldCheck className="size-4" aria-hidden="true" />
        ) : (
          <ShieldBan className="size-4" aria-hidden="true" />
        )}
        {t(action)}
      </button>

      <ConfirmDialog
        open={open}
        // Styled explicitly below rather than through the dialog's own
        // destructive wrapper, so the unblock button keeps a real background.
        destructive={false}
        title={t(`${action}Title`)}
        description={t(`${action}Body`, { name: customerName })}
        confirmLabel={t(action)}
        cancelLabel={t("cancel")}
        onCancel={() => setOpen(false)}
      >
        <form action={formAction} className="flex flex-col items-stretch gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input
            type="hidden"
            name="blocked"
            value={isBlocked ? "false" : "true"}
          />
          {isBlocked ? null : (
            <label className="text-start text-xs font-bold">
              {t("reasonLabel")}
              <textarea
                name="reason"
                rows={2}
                maxLength={500}
                className="mt-1.5 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
              />
              <span className="mt-1 block font-normal text-muted-foreground">
                {t("reasonHint")}
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={`inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 ${
              isBlocked ? "bg-primary" : "bg-destructive"
            }`}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t(`${action}Confirm`)}
          </button>
        </form>
      </ConfirmDialog>
    </>
  );
}
