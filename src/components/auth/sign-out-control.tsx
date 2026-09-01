"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { signOutAction } from "@/actions/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Locale } from "@/i18n/routing";

/**
 * Standalone sign-out control with the shared confirmation dialog, for pages
 * that need it outside the header menu (account settings today; the Admin
 * workspace in Phase 5 can reuse the same component).
 */
export function SignOutControl({
  locale,
  labels,
}: {
  locale: Locale;
  labels: {
    signOut: string;
    confirmTitle: string;
    confirmBody: string;
    cancel: string;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold"
      >
        <LogOut className="size-4 rtl:rotate-180" aria-hidden="true" />
        {labels.signOut}
      </button>
      <ConfirmDialog
        open={confirming}
        title={labels.confirmTitle}
        description={labels.confirmBody}
        confirmLabel={labels.signOut}
        cancelLabel={labels.cancel}
        onCancel={() => setConfirming(false)}
      >
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="inline-flex h-11 min-h-11 items-center rounded-full px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            {labels.signOut}
          </button>
        </form>
      </ConfirmDialog>
    </>
  );
}
