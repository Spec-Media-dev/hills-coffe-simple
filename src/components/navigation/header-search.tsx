"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLocale } from "next-intl";
import {
  SuggestionList,
  useSearchCombobox,
  type SuggestionLabels,
} from "./search-suggestions";

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
 *
 * ---
 *
 * **From `xl` up the field is simply always there.** Desktop has the width, and
 * an icon that hides a text box is a worse trade at 1280px than at 375px. The
 * breakpoint matches the one where the primary nav appears, so the field and the
 * nav arrive together or not at all. Below `xl` nothing changes: icon trigger on
 * `sm`+, drawer form on phones.
 *
 * Visibility is decided in CSS, never in JavaScript. Reading a media query
 * during render would make the server and the client disagree about whether the
 * form exists, which is a hydration error; `open` therefore only ever governs
 * the small-screen panel.
 *
 * Mounting the form on every page is what this component previously backed out
 * of, for two concrete reasons, and both are handled rather than re-inherited:
 *
 * 1. **No second submit button.** The magnifier is `type="button"` calling
 *    `submit()` directly, and Enter is handled explicitly on the form. A real
 *    `type="submit"` here would make the bare `button[type="submit"]` selector
 *    that several suites use to sign in ambiguous on `/sign-in` — the exact
 *    breakage that sent this form back behind a trigger last time. Behaviour is
 *    identical either way: click searches, Enter searches, and with JavaScript
 *    off the form still GETs `/search`.
 * 2. **A named search landmark.** `role="search"` also appears in the catalog
 *    filters and on `/search`, so those pages now carry two. Giving this one an
 *    explicit accessible name is what keeps two landmarks of the same role
 *    correct rather than merely duplicated.
 */
export function HeaderSearch({
  labels,
  suggestionLabels,
}: {
  labels: {
    open: string;
    close: string;
    placeholder: string;
    submit: string;
    clear: string;
  };
  suggestionLabels: SuggestionLabels;
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

  // Typeahead: suggestions under the field while typing; Enter with nothing
  // highlighted still runs `submit()` and opens the full results page.
  const comboboxRef = useRef<HTMLDivElement>(null);
  const combobox = useSearchCombobox({
    value,
    containerRef: comboboxRef,
    onSubmitQuery: submit,
    onNavigate: () => setOpen(false),
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        // The panel is now always in the document — hidden below `xl` until
        // this trigger reveals it — so the reference is always resolvable.
        aria-controls={panelId}
        data-testid="header-search-trigger"
        /*
         * Desktop-only, and that is a measured decision rather than a taste
         * one: shown at every width it pushed the authenticated header past
         * 375px (`p12-visual` caught horizontal overflow on /account, where
         * the account menu is wider than the sign-in button). Phones reach
         * search through the drawer form instead.
         */
        className={`nav-chip size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          // `xl:hidden` because from there up the field itself is on screen and
          // a trigger for it would be a second control doing nothing new.
          open ? "hidden" : "hidden sm:grid xl:hidden"
        }`}
      >
        <span className="sr-only">{labels.open}</span>
        <Search className="size-4" aria-hidden="true" />
      </button>

      <form
        id={panelId}
        role="search"
        aria-label={labels.submit}
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
            return;
          }
          /*
           * Enter is handled here rather than left to implicit submission.
           * With no submit button in the form, whether Enter submits at all
           * depends on a corner of the HTML spec about how many fields block
           * implicit submission — so it is stated outright instead. The
           * `preventDefault` also stops a native submit racing this one and
           * pushing the same route twice.
           */
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        /*
         * `xl:w-48` rather than the earlier `w-44`: it still leaves the prompt
         * was clipped mid-word ("Search coffees, o…"), which made a working
         * field look broken. The header has the room — logo, nav and the
         * utility cluster leave well over 400px of slack at 1280 — so the
         * field is widened to the point where the prompt reads, and grows
         * again once the container stops being the constraint.
         */
        className={`absolute inset-x-0 top-full z-30 items-center gap-2 border-b border-border bg-background p-3 sm:static sm:inset-auto sm:z-auto sm:w-72 sm:border-0 sm:bg-transparent sm:p-0 xl:w-56 2xl:w-64 ${
          open ? "flex" : "hidden xl:flex"
        }`}
      >
        <div
          ref={comboboxRef}
          className="relative min-w-0 flex-1"
          onBlur={combobox.onContainerBlur}
        >
          <label className="relative block">
            <span className="sr-only">{labels.placeholder}</span>
            <input
              ref={inputRef}
              name="q"
              type="search"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                combobox.setOpen(true);
              }}
              placeholder={labels.placeholder}
              data-testid="header-search-input"
              {...combobox.inputProps}
              className="nav-field h-11 w-full rounded-full border ps-4 pe-[4.5rem] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:h-10 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              className="absolute end-9 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-current opacity-60 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:end-8 xl:size-7"
            >
              <span className="sr-only">{labels.clear}</span>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          {/* `type="button"`, deliberately — see the note at the top of the
              file. It runs the same `submit()` the form does. */}
          <button
            type="button"
            onClick={submit}
            data-testid="header-search-submit"
            className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-current opacity-70 transition hover:text-gold-contrast hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:size-8"
          >
            <span className="sr-only">{labels.submit}</span>
            <Search className="size-4" aria-hidden="true" />
          </button>
          {/* Positioned against this field, outside any overflow clip: the
              header bar has none, so the list is never cut off. */}
          <SuggestionList
            combobox={combobox}
            labels={suggestionLabels}
            variant="glass"
            className="absolute end-0 top-[calc(100%+0.75rem)] z-50 w-[min(26rem,calc(100vw-1.5rem))]"
          />
        </div>
        {/* Nothing to close once the field is permanently on screen. */}
        <button
          type="button"
          onClick={() => close()}
          data-testid="header-search-close"
          className="nav-chip grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
        >
          <span className="sr-only">{labels.close}</span>
          <X className="size-4" aria-hidden="true" />
        </button>
      </form>
    </>
  );
}
