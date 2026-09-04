"use client";

import { Menu, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark, type BrandLogo } from "@/components/brand/mark";
import { Link } from "@/i18n/navigation";
import { DrawerReveal } from "@/components/motion/primitives";

type Item = { href: string; label: string };

export function MobileMenu({
  items,
  openLabel,
  closeLabel,
  brandLabel = "Hills Coffee",
  logo = null,
  actionHref,
  actionLabel,
  origins,
  labels,
}: {
  items: Item[];
  openLabel: string;
  closeLabel: string;
  brandLabel?: string;
  /** Resolved by the server header; this component never reads the database. */
  logo?: BrandLogo | null;
  actionHref: string | null;
  actionLabel: string | null;
  /** Real active origins, already localized. Labels only — no dataset. */
  origins: { slug: string; label: string }[];
  labels: {
    searchPlaceholder: string;
    searchSubmit: string;
    origins: string;
    originsAll: string;
  };
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
    <div className="xl:hidden">
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
      {/* Portalled to <body>. The site header carries a `view-transition-name`,
          which makes it the containing block for any fixed descendant: left
          inside it, this drawer resolved `inset-0` against the 80px header box
          instead of the viewport, so on a scrolled page it opened off-screen
          and the footer took the taps meant for it. */}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 xl:hidden">
              <button
                type="button"
                aria-label={closeLabel}
                className="absolute inset-0 cursor-default bg-primary/35 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <DrawerReveal
                ref={dialogRef}
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-label={openLabel}
                className="absolute inset-y-0 start-0 flex w-[min(92vw,28rem)] flex-col overflow-y-auto overscroll-contain border-e border-border bg-background px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl [--drawer-enter-x:-28px] rtl:[--drawer-enter-x:28px]"
              >
                <div className=" flex  w-full items-center justify-between border-b border-border pb-4">
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
                {/*
                 * The drawer is where search lives on a phone: the header bar
                 * has no spare width at 360px, and squeezing a field in there
                 * is what causes the overflow this project has already had to
                 * fix once. A plain GET form needs no client state.
                 */}
                {/*
                 * No `onSubmit` handler on purpose. Closing the drawer here
                 * unmounted this portal before the browser had finished
                 * submitting, so the navigation was cancelled and Enter did
                 * nothing. The navigation itself tears the drawer down.
                 */}
                <form
                  role="search"
                  action="/search"
                  method="get"
                  className="relative mt-6"
                >
                  <label>
                    <span className="sr-only">{labels.searchPlaceholder}</span>
                    <input
                      name="q"
                      type="search"
                      placeholder={labels.searchPlaceholder}
                      data-testid="mobile-search-input"
                      className="h-12 w-full rounded-xl border border-input bg-background ps-4 pe-12 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <button
                    type="submit"
                    className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground"
                  >
                    <span className="sr-only">{labels.searchSubmit}</span>
                    <Search className="size-4" aria-hidden="true" />
                  </button>
                </form>
                <nav className="flex flex-col pt-6" aria-label={openLabel}>
                  {items.map((item, index) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-14 touch-manipulation items-center justify-between border-b border-border py-4 text-xl font-semibold transition-colors hover:text-highlight focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-highlight">
                        0{index + 1}
                      </span>
                    </Link>
                  ))}
                </nav>
                {origins.length ? (
                  <div className="pt-8">
                    <p className="eyebrow">{labels.origins}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {origins.slice(0, 8).map((origin) => (
                        <Link
                          key={origin.slug}
                          href={`/green-coffee-offer-list?origin=${origin.slug}`}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm transition-colors hover:border-highlight focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {origin.label}
                        </Link>
                      ))}
                      <Link
                        href="/coffee-origins"
                        onClick={() => setOpen(false)}
                        className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-highlight focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {labels.originsAll}
                      </Link>
                    </div>
                  </div>
                ) : null}
                {actionHref && actionLabel ? (
                  <div className="mt-auto pt-10">
                    <Link
                      href={actionHref}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center justify-center bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
                    >
                      {actionLabel}
                    </Link>
                  </div>
                ) : null}
              </DrawerReveal>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
