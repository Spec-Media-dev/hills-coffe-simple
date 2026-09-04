"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLocale } from "next-intl";

/**
 * Header search that opens in place.
 *
 * The icon used to be a link straight to the catalog, so "search" navigated
 * before anyone had typed anything. Now it reveals an input, focuses it, and
 * navigates only on submit.
 *
 * **The expansion animates `width`, never `transform`.** That is the whole RTL
 * strategy. A translate-based reveal has to be mirrored by hand, and the last
 * time this codebase combined a logical offset with a physical translate the
 * Arabic mega-menu panel ended up 760px adrift with its leading edge off
 * screen. A width transition inside a flex row has no direction of its own: the
 * row's own `dir` decides which way the field grows, so LTR and RTL are correct
 * from the same declaration.
 *
 * On a phone the header has no spare width, so the same single form reflows to
 * a full-width panel directly beneath the header. One form, one input, one
 * focus target — the alternative, a second hidden field for small screens,
 * gives the accessibility tree two search boxes and the focus logic two places
 * to be wrong.
 */
export function HeaderSearch({
  labels,
}: {
  labels: { open: string; close: string; placeholder: string; submit: string };
}) {
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const panelId = useId();

  /*
   * Focus has to move *after* the render that shows or hides the elements.
   * Calling `trigger.focus()` inside the close handler ran while the trigger
   * was still hidden, so the browser refused it and focus fell to the body —
   * which for a keyboard user means Escape loses their place entirely.
   */
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const close = (restore = true) => {
    restoreFocus.current = restore;
    setOpen(false);
  };

  const submit = () => {
    const query = value.trim();
    // An empty search would navigate to a results page about nothing.
    if (!query) {
      inputRef.current?.focus();
      return;
    }
    const prefix = locale === "ar" ? "/ar" : "";
    router.push(`${prefix}/search?q=${encodeURIComponent(query)}`);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        // Only reference the panel while it exists, so the attribute never
        // points at a missing id.
        aria-controls={open ? panelId : undefined}
        data-testid="header-search-trigger"
        /*
         * Desktop-only, and that is a measured decision rather than a taste
         * one: shown at every width it pushed the authenticated header past
         * 375px (`p12-visual` caught horizontal overflow on /account, where
         * the account menu is wider than the sign-in button). Phones reach
         * search through the drawer form instead.
         */
        className={`size-11 shrink-0 place-items-center rounded-full border border-border transition hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "hidden" : "hidden sm:grid"
        }`}
      >
        <span className="sr-only">{labels.open}</span>
        <Search className="size-4" aria-hidden="true" />
      </button>

      {/*
       * Rendered only while open, not merely hidden.
       *
       * A permanently-mounted form put a second `role="search"` landmark and a
       * second submit button into every page in the site — which is both a
       * worse accessibility tree and, concretely, ambiguous for anything that
       * addresses "the submit button" on a sign-in or admin form.
       */}
      {open ? (
        <form
          id={panelId}
          role="search"
          action="/search"
          method="get"
          data-testid="header-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="absolute inset-x-0 top-full z-30 flex items-center gap-2 border-b border-border bg-background p-3 sm:static sm:inset-auto sm:z-auto sm:w-72 sm:border-0 sm:bg-transparent sm:p-0"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{labels.placeholder}</span>
            <input
              ref={inputRef}
              name="q"
              type="search"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={labels.placeholder}
              data-testid="header-search-input"
              className="h-11 w-full rounded-full border border-input bg-background ps-4 pe-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">{labels.submit}</span>
              <Search className="size-4" aria-hidden="true" />
            </button>
          </label>
          <button
            type="button"
            onClick={() => close()}
            data-testid="header-search-close"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border transition hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">{labels.close}</span>
            <X className="size-4" aria-hidden="true" />
          </button>
        </form>
      ) : null}
    </>
  );
}
