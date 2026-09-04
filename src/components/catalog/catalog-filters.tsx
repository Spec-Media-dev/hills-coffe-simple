"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

/**
 * Catalog filters that apply themselves.
 *
 * Selecting an origin and then hunting for an "Apply" button is the friction
 * this removes: every control commits on change, and free text commits after a
 * short pause so a five-letter word costs one navigation instead of five.
 *
 * The URL stays the source of truth. Filters are query parameters, results are
 * server-rendered from them, and nothing about the catalog is fetched into the
 * client — so a filtered view is shareable, survives a reload, and works with
 * the back button. `replace` rather than `push` keeps a history entry per
 * *visit* rather than per checkbox, so Back leaves the catalog instead of
 * walking backwards through every toggle.
 *
 * Without JavaScript this is still a plain GET form: the `<noscript>` submit
 * button below restores the manual path, and the server contract is unchanged.
 */

export type FilterOption = { value: string; label: string };

export type CatalogFilterValues = {
  q: string;
  origin: string;
  process: string;
  location: string;
  type: string;
  availability: string;
  sort: string;
  certified: boolean;
};

/** Parameters this panel owns — the only ones Reset is allowed to clear. */
const OWNED = [
  "q",
  "origin",
  "process",
  "location",
  "type",
  "availability",
  "sort",
  "certified",
  "page",
] as const;

const DEBOUNCE_MS = 300;

export function CatalogFilters({
  values,
  options,
  labels,
  activeCount,
  action,
}: {
  values: CatalogFilterValues;
  options: {
    origins: FilterOption[];
    processes: FilterOption[];
    locations: FilterOption[];
    types: FilterOption[];
    availability: FilterOption[];
    sorts: FilterOption[];
  };
  labels: {
    filters: string;
    search: string;
    origin: string;
    process: string;
    location: string;
    category: string;
    availability: string;
    sort: string;
    certified: string;
    clear: string;
    apply: string;
    applying: string;
  };
  activeCount: number;
  /** Canonical, already-localized listing path for the no-JS form target. */
  action: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(values.q);
  /*
   * The checkbox mirrors its own state as well as the URL. Without this the
   * control stayed visually unchecked until the server round trip finished,
   * because React keeps the previous UI during a transition — a tick that
   * appears to do nothing for half a second reads as broken.
   */
  const [certified, setCertified] = useState(values.certified);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the query string changes underneath us — Back/Forward, or Reset — the
  // input must follow, or the box and the results disagree.
  useEffect(() => setText(values.q), [values.q]);
  useEffect(() => setCertified(values.certified), [values.certified]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const commit = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    // Any change to what matches must return to the first page, or a visitor
    // on page 4 of one filter lands on an empty page 4 of the next.
    if (!("page" in changes)) params.delete("page");
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      }),
    );
  };

  const onText = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit({ q: value.trim() }), DEBOUNCE_MS);
  };

  const submitNow = () => {
    if (timer.current) clearTimeout(timer.current);
    commit({ q: text.trim() });
  };

  const reset = () => {
    const params = new URLSearchParams(window.location.search);
    // Only this panel's parameters. Anything else on the URL is not ours.
    for (const key of OWNED) params.delete(key);
    setText("");
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      }),
    );
  };

  const select = (
    name: keyof CatalogFilterValues,
    label: string,
    list: FilterOption[],
  ) => (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        value={String(values[name] ?? "")}
        onChange={(event) => commit({ [name]: event.target.value })}
        className="h-12 w-full appearance-none truncate rounded-xl border border-input bg-background px-4 pe-9 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{label}</option>
        {list.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between border border-primary bg-primary px-4 text-sm font-bold text-primary-foreground md:hidden"
        aria-expanded={open}
        aria-controls="catalog-filter-panel"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal
            className="size-4 text-highlight"
            aria-hidden="true"
          />
          {labels.filters}
          {activeCount ? (
            <span className="grid size-6 place-items-center rounded-full bg-highlight text-xs text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        {open ? <X className="size-4" aria-hidden="true" /> : null}
      </button>

      <form
        id="catalog-filter-panel"
        data-testid="catalog-filters"
        action={action}
        method="get"
        role="search"
        aria-busy={pending}
        onSubmit={(event) => {
          // With JS the navigation is ours; without it the browser submits.
          event.preventDefault();
          submitNow();
        }}
        className={`${open ? "grid" : "hidden"} gap-3 border border-border bg-card p-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`}
      >
        <label className="relative xl:col-span-2">
          <span className="sr-only">{labels.search}</span>
          <Search
            className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            name="q"
            type="search"
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder={labels.search}
            className="h-12 w-full rounded-xl border border-input bg-background ps-11 pe-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {select("origin", labels.origin, options.origins)}
        {select("process", labels.process, options.processes)}
        {select("location", labels.location, options.locations)}
        {select("type", labels.category, options.types)}
        {select("availability", labels.availability, options.availability)}
        {select("sort", labels.sort, options.sorts)}

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-input bg-background px-4 text-sm font-medium">
          <input
            type="checkbox"
            name="certified"
            value="1"
            checked={certified}
            onChange={(event) => {
              setCertified(event.target.checked);
              commit({ certified: event.target.checked ? "1" : null });
            }}
            className="size-4 accent-[var(--color-gold)]"
          />
          {labels.certified}
        </label>

        {activeCount ? (
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl border border-border px-4 text-sm font-bold transition-colors hover:border-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels.clear}
          </button>
        ) : null}

        {/* Restores a manual path when scripting is unavailable. */}
        <noscript>
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-gold px-5 text-sm font-bold text-[#17251c]"
          >
            {labels.apply}
          </button>
        </noscript>
      </form>

      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-xs text-muted-foreground transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
      >
        {pending ? labels.applying : ""}
      </p>
    </div>
  );
}
