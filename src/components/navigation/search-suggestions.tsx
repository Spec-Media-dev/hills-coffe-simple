"use client";

import Image from "next/image";
import { ArrowUpRight, Loader2, MapPin, Search, Sprout } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
// Types only: the data module is server-only and never reaches the bundle.
import type { Suggestion, SuggestResponse } from "@/lib/data/search";

/** Must agree with `SUGGEST_MIN_LENGTH` in `src/lib/data/search.ts`. */
const MIN_LENGTH = 2;
/** Long enough to skip the keystrokes of a word being typed, short enough to feel live. */
const DEBOUNCE_MS = 180;
/** Recent answers kept for backspacing and retyping, per mounted field. */
const MAX_CACHED = 40;

export type SuggestionLabels = {
  suggestions: string;
  searching: string;
  /** Contains `{q}`. */
  noSuggestions: string;
  noSuggestionsHint: string;
  /** Contains `{q}`. */
  viewAll: string;
  coffees: string;
  origins: string;
  /** Contains `{count}`. */
  suggestionCount: string;
};

type Status = "idle" | "loading" | "ready" | "error";

const keyFor = (locale: string, query: string) =>
  `${locale}:${query.trim().toLowerCase()}`;

/**
 * Debounced, cancellable suggestion fetching.
 *
 * Nothing is set synchronously while typing: status is *derived* from the
 * current query and the answers already held, and state only changes when a
 * response arrives. Every keystroke cancels the previous timer and aborts the
 * previous request, so an older, slower answer can never land after a newer
 * one and overwrite it. Answers are kept per query, so backspacing to a query
 * already seen is instant and costs no request.
 */
export function useSearchSuggestions(query: string, enabled: boolean) {
  const locale = useLocale();
  const [answers, setAnswers] = useState<Map<string, SuggestResponse>>(
    () => new Map(),
  );
  const [failed, setFailed] = useState<string | null>(null);
  const trimmed = query.trim();
  const key = keyFor(locale, trimmed);
  const active = enabled && trimmed.length >= MIN_LENGTH;
  const answer = active ? answers.get(key) : undefined;

  useEffect(() => {
    if (!active || answer) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}&locale=${locale}`,
          {
            signal: controller.signal,
            headers: { accept: "application/json" },
          },
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as SuggestResponse;
        setAnswers((previous) => {
          const next = new Map(previous);
          next.set(key, data);
          while (next.size > MAX_CACHED) {
            const oldest = next.keys().next().value;
            if (oldest === undefined) break;
            next.delete(oldest);
          }
          return next;
        });
      } catch {
        if (!controller.signal.aborted) setFailed(key);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, answer, key, locale, trimmed]);

  // While the next answer is on its way, the last one stays on screen (dimmed)
  // instead of the list collapsing and re-opening on every keystroke.
  const [shown, setShown] = useState<SuggestResponse | null>(null);
  if (answer && shown !== answer) setShown(answer);

  const status: Status = !active
    ? "idle"
    : answer
      ? "ready"
      : failed === key
        ? "error"
        : "loading";

  return {
    status,
    query: trimmed,
    data: status === "idle" ? null : (answer ?? shown),
  };
}

/**
 * Combobox behaviour shared by the header field and the mobile drawer field:
 * ARIA wiring, ArrowUp/ArrowDown/Enter/Escape, outside-click dismissal and
 * prefetching the highlighted result so opening it feels immediate.
 */
export function useSearchCombobox({
  value,
  containerRef,
  onSubmitQuery,
  onNavigate,
}: {
  value: string;
  /** The element wrapping the field and the list; owned by the caller. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubmitQuery: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Loaded whenever the typed value is long enough, independent of whether
  // the list is showing: Escape hides the list, and ArrowDown must be able to
  // bring the same results straight back and highlight the first one.
  const suggestions = useSearchSuggestions(value, true);
  const items = suggestions.data?.items ?? [];
  // The "see all results" row is the last option, so the keyboard can reach
  // the full search without leaving the list.
  const optionCount = suggestions.status === "idle" ? 0 : items.length + 1;
  const visible = open && suggestions.status !== "idle";

  // Reset the highlight whenever the result set changes. Compared by the
  // response object (stable per answer), never by the derived `items` array.
  const [lastData, setLastData] = useState(suggestions.data);
  if (lastData !== suggestions.data) {
    setLastData(suggestions.data);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!visible) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [containerRef, visible]);

  const hrefAt = (index: number) =>
    index >= 0 && index < items.length ? items[index].href : null;

  const highlight = (index: number) => {
    setActiveIndex(index);
    const href = hrefAt(index);
    if (href) router.prefetch(href);
  };

  const choose = (index: number) => {
    const href = hrefAt(index);
    setOpen(false);
    if (href) {
      router.push(href);
      onNavigate?.();
    } else {
      onSubmitQuery();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      if (optionCount) highlight(Math.min(activeIndex + 1, optionCount - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (optionCount) highlight(Math.max(activeIndex - 1, -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // Stop the surrounding form's own Enter handling from running twice.
      event.stopPropagation();
      if (visible && activeIndex >= 0) choose(activeIndex);
      else {
        setOpen(false);
        onSubmitQuery();
      }
      return;
    }
    if (event.key === "Escape" && visible) {
      // Close the list first; a second Escape reaches the surrounding panel.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return {
    listId,
    open: visible,
    setOpen,
    activeIndex,
    highlight,
    choose,
    suggestions,
    inputProps: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": visible,
      "aria-controls": listId,
      "aria-activedescendant":
        visible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
      autoComplete: "off",
      onKeyDown,
      onFocus: () => setOpen(true),
    },
    onContainerBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setOpen(false);
    },
  };
}

/** Wraps the matched part of a title so the eye finds why it matched. */
function Highlighted({ text, query }: { text: string; query: string }) {
  // Arabic letters join across the match boundary; a weight change inside a
  // word breaks those joins, so Arabic titles are shown unmarked.
  if (/[؀-ۿ]/.test(text)) return <>{text}</>;
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-extrabold text-current">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

function Thumbnail({ item }: { item: Suggestion }) {
  if (item.kind === "origin")
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-current/10">
        <MapPin className="size-4 text-gold-text" aria-hidden="true" />
      </span>
    );
  return (
    <span className="highlight-fallback relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl">
      <Sprout
        className="relative size-4 text-gold-contrast/80"
        aria-hidden="true"
      />
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      ) : null}
    </span>
  );
}

/**
 * The dropdown itself. `variant` only changes the surface: `glass` sits on the
 * green header bar, `surface` sits inside the cream/dark mobile drawer.
 */
export function SuggestionList({
  combobox,
  labels,
  variant,
  className,
}: {
  combobox: ReturnType<typeof useSearchCombobox>;
  labels: SuggestionLabels;
  variant: "glass" | "surface";
  className?: string;
}) {
  const { suggestions, listId, activeIndex, highlight, choose, open } =
    combobox;
  const items = suggestions.data?.items ?? [];
  const query = suggestions.query;
  const coffees = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === "coffee");
  const origins = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === "origin");
  const loading = suggestions.status === "loading";
  const empty = suggestions.status === "ready" && items.length === 0;
  const glass = variant === "glass";

  const option = ({ item, index }: { item: Suggestion; index: number }) => (
    <Link
      key={`${item.kind}-${item.id}`}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={activeIndex === index}
      href={item.href}
      tabIndex={-1}
      lang={item.lang}
      onPointerMove={() => activeIndex !== index && highlight(index)}
      onClick={(event) => {
        // Plain clicks go through `choose` so the panel closes and the drawer
        // (if any) is dismissed; modified clicks keep the browser's behaviour.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
          return;
        event.preventDefault();
        choose(index);
      }}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition-colors",
        activeIndex === index && (glass ? "bg-white/10" : "bg-muted"),
      )}
    >
      <Thumbnail item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          <Highlighted text={item.title} query={query} />
        </span>
        {item.meta ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-xs",
              glass ? "text-white/60" : "text-muted-foreground",
            )}
          >
            {item.meta}
          </span>
        ) : null}
      </span>
      <ArrowUpRight
        className={cn(
          "size-4 shrink-0 transition-opacity rtl:-scale-x-100",
          activeIndex === index ? "opacity-80" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </Link>
  );

  const groupLabel = cn(
    "px-2.5 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] rtl:tracking-normal",
    glass ? "text-gold-contrast/85" : "text-gold-text",
  );
  const viewAllIndex = items.length;

  return (
    <div
      className={cn(
        !open && "hidden",
        glass
          ? "search-suggest-glass rounded-2xl p-1.5 text-[#f3ecdd]"
          : "rounded-2xl border border-border bg-card p-1.5 text-card-foreground",
        className,
      )}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {open && suggestions.status === "ready"
          ? labels.suggestionCount.replace("{count}", String(items.length))
          : ""}
      </p>
      <div
        id={listId}
        role="listbox"
        aria-label={labels.suggestions}
        aria-busy={loading}
        className={cn(
          "max-h-[min(26rem,60svh)] overflow-y-auto overscroll-contain transition-opacity",
          loading && items.length ? "opacity-60" : "opacity-100",
        )}
        data-lenis-prevent
      >
        {coffees.length ? (
          <div role="group" aria-label={labels.coffees}>
            <p aria-hidden="true" className={groupLabel}>
              {labels.coffees}
            </p>
            {coffees.map(option)}
          </div>
        ) : null}
        {origins.length ? (
          <div role="group" aria-label={labels.origins}>
            <p aria-hidden="true" className={groupLabel}>
              {labels.origins}
            </p>
            {origins.map(option)}
          </div>
        ) : null}

        {loading && !items.length ? (
          <p
            className={cn(
              "flex items-center gap-2 px-3 py-4 text-sm",
              glass ? "text-white/70" : "text-muted-foreground",
            )}
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {labels.searching}
          </p>
        ) : null}
        {empty || suggestions.status === "error" ? (
          <div className="px-3 py-4 text-sm">
            <p className="font-semibold">
              {labels.noSuggestions.replace("{q}", query)}
            </p>
            <p
              className={cn(
                "mt-1",
                glass ? "text-white/60" : "text-muted-foreground",
              )}
            >
              {labels.noSuggestionsHint}
            </p>
          </div>
        ) : null}

        <div
          id={`${listId}-${viewAllIndex}`}
          role="option"
          aria-selected={activeIndex === viewAllIndex}
          onPointerMove={() =>
            activeIndex !== viewAllIndex && highlight(viewAllIndex)
          }
          onClick={() => choose(viewAllIndex)}
          className={cn(
            "mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-t px-3 py-2.5 text-sm font-bold transition-colors",
            glass ? "border-white/10" : "border-border",
            activeIndex === viewAllIndex &&
              (glass ? "bg-white/10" : "bg-muted"),
          )}
        >
          <Search className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {labels.viewAll.replace("{q}", query)}
          </span>
          {loading ? (
            <Loader2
              className="size-3.5 shrink-0 animate-spin opacity-60"
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
