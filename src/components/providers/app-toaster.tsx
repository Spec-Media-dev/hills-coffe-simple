"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * The toast surface, painted with the product's own tokens.
 *
 * Two things were wrong with the default configuration. It ran with
 * `richColors`, whose tinted palette put a serious contrast failure on screen
 * (axe flagged the toast title on the verification notice). And it was given
 * no `theme`, so Sonner stayed on its light palette while the rest of the page
 * followed the user's dark preference.
 *
 * Reading the resolved theme fixes the second, and dropping `richColors` in
 * favour of `--card`/`--foreground` fixes the first: those pairs are the same
 * ones the rest of the interface is measured against, so the toast inherits
 * contrast that is already known to pass rather than carrying a palette of its
 * own. Success and failure stay distinguishable through the icon colour, which
 * is not the only signal — the message itself says which it is.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      closeButton
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-foreground !border !border-border !shadow-[var(--shadow-soft)] !rounded-xl",
          title: "!text-foreground !font-bold",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-foreground",
          closeButton: "!bg-card !text-foreground !border-border",
          success: "[&_[data-icon]]:!text-emerald-700 dark:[&_[data-icon]]:!text-emerald-300",
          error: "[&_[data-icon]]:!text-destructive",
        },
      }}
    />
  );
}
