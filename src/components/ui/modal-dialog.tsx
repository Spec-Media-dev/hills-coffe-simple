"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/motion/primitives";

/**
 * The project's accessible modal shell.
 *
 * Phase 4's `ConfirmDialog` established this behaviour for confirmations; the
 * inquiry dialog needs the same guarantees around an arbitrary form body, so
 * the behaviour lives here once rather than being written twice:
 *
 *  - focus moves into the dialog on open, and back to the trigger on close;
 *  - Tab and Shift+Tab stay inside;
 *  - Escape closes;
 *  - the background is inert to pointer and assistive technology, and does
 *    not scroll;
 *  - the dialog is named and described for screen readers;
 *  - the close control has a real accessible name.
 *
 * Buttons use logical order, so RTL mirrors without any per-locale branch.
 */
export function ModalDialog({
  open,
  title,
  description,
  closeLabel,
  onClose,
  children,
  eyebrow,
}: {
  open: boolean;
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  eyebrow?: string;
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

    // `tabIndex === -1` and `aria-hidden` are both excluded, not only the
    // `[tabindex]` selector arm. Without that the spam honeypot — an input
    // that is deliberately off-screen, aria-hidden and tab-index -1 — matched
    // as a plain `input`, and a keyboard user opening the dialog landed on a
    // field they could neither see nor be told about.
    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
        ) ?? [],
      ).filter(
        (node) =>
          node.offsetParent !== null &&
          node.tabIndex !== -1 &&
          node.getAttribute("aria-hidden") !== "true",
      );

    // Prefer the first real control over the close button, so a keyboard user
    // lands where the work is.
    const initial = focusable();
    (initial.find((node) => node.tagName !== "BUTTON") ?? initial[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  // Rendered into <body> rather than in place. The site shell gives <main>
  // and <footer> their own `view-transition-name`, and a named element is a
  // stacking context: two sibling stacking contexts at `z-index: auto` paint
  // in source order, so the footer covered every dialog opened from the page
  // beneath it — `z-[80]` cannot escape an ancestor context. At body level the
  // dialog is a sibling of the shell, and the z-index means what it says.
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-end p-0 sm:place-items-center sm:p-5">
      {/* Inert backdrop: hidden from assistive technology and unfocusable, so
          the dialog is the only thing reachable. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-forest-deep/60 backdrop-blur-sm"
      />
      <Modal
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="mt-3 text-3xl">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-2 text-sm text-muted-foreground"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="grid size-11 min-h-11 shrink-0 place-items-center rounded-full border border-border transition hover:border-gold"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </Modal>
    </div>,
    document.body,
  );
}
