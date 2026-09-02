"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BrandMark, type BrandLogo } from "@/components/brand/mark";
import { Link } from "@/i18n/navigation";

type Item = { href: string; label: string };

export function MobileMenu({
  items,
  openLabel,
  closeLabel,
  brandLabel = "Hills Coffee",
  logo = null,
}: {
  items: Item[];
  openLabel: string;
  closeLabel: string;
  brandLabel?: string;
  /** Resolved by the server header; this component never reads the database. */
  logo?: BrandLogo | null;
}) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-11 touch-manipulation place-items-center rounded-full border border-border transition-colors hover:border-gold hover:text-gold focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-haspopup="dialog"
        aria-label={open ? closeLabel : openLabel}
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Menu className="size-5" aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 cursor-default bg-primary/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={openLabel}
            className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto overscroll-contain border-b border-border bg-background px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between border-b border-border pb-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandMark height={36} label={brandLabel} logo={logo} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 touch-manipulation place-items-center rounded-full border border-border transition-colors hover:border-gold hover:text-gold focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={closeLabel}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav
              className="mx-auto flex max-w-3xl flex-col pt-3"
              aria-label={openLabel}
            >
              {items.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 touch-manipulation items-center justify-between border-b border-border py-4 text-xl font-medium transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-highlight">0{index + 1}</span>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      ) : null}
    </div>
  );
}
