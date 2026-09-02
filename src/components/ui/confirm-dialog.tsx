"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/motion/primitives";

/**
 * Shared confirmation dialog.
 *
 * Built to be reused by the customer sign-out flow (Phase 4), the Admin
 * sign-out (Phase 5), and destructive Admin actions (Phase 7), so those phases
 * wire this component up rather than each growing their own.
 *
 * Implements the modal-dialog semantics the existing mobile menu already
 * establishes: `role="dialog"`, `aria-modal`, focus moved inside on open,
 * focus trapped, Escape closes, focus returned to the trigger on close, and
 * background scroll locked.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onCancel,
  children,
  destructive = true,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  /** The confirming control — typically a form wrapping a submit button. */
  children: React.ReactNode;
  destructive?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so a keyboard or screen-reader user is not
    // left behind on the page underneath.
    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  // Rendered into <body> rather than in place. The site shell gives <main>
  // and <footer> their own `view-transition-name`, and a named element is a
  // stacking context: two sibling stacking contexts at `z-index: auto` paint
  // in source order, so the footer covered every dialog opened from the page
  // beneath it — `z-[80]` cannot escape an ancestor context. At body level the
  // dialog is a sibling of the shell, and the z-index means what it says.
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center p-5">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-forest-deep/60 backdrop-blur-sm"
      />
      <Modal
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8"
      >
        <h2 id={titleId} className="text-2xl font-bold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-3 text-sm text-muted-foreground">
          {description}
        </p>
        {/* Buttons use logical order so RTL mirrors correctly. */}
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold"
          >
            {cancelLabel}
          </button>
          <div
            className={destructive ? "[&_button]:bg-destructive" : undefined}
          >
            {children}
          </div>
        </div>
        <span className="sr-only">{confirmLabel}</span>
      </Modal>
    </div>,
    document.body,
  );
}
