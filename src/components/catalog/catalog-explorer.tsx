"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import type { CatalogCoffee } from "@/data/types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Labels = Record<
  | "search"
  | "filters"
  | "origin"
  | "process"
  | "location"
  | "certification"
  | "availability"
  | "category"
  | "sort"
  | "showing"
  | "coffee"
  | "profile"
  | "offer"
  | "bags"
  | "details"
  | "noResults"
  | "reset"
  | "pricing"
  | "view"
  | "all"
  | "specialty"
  | "commercial",
  string
>;
type Filters = {
  query: string;
  category: string;
  origin: string;
  process: string;
  location: string;
  certification: string;
  status: string;
};

const initialFilters: Filters = {
  query: "",
  category: "all",
  origin: "all",
  process: "all",
  location: "all",
  certification: "all",
  status: "all",
};

function SelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <label className="grid gap-2 text-[.68rem] font-bold uppercase tracking-[.12em] text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 rounded-xl border border-input bg-card px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CatalogExplorer({
  coffees,
  labels,
  initialLocation,
}: {
  coffees: CatalogCoffee[];
  labels: Labels;
  initialLocation?: string;
}) {
  const locale = useLocale() as Locale;
  const allLabel = locale === "ar" ? "الكل" : "All";
  const reduced = useReducedMotion();
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters,
    location: initialLocation || "all",
  });
  const [sort, setSort] = useState("name");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const origins = [...new Set(coffees.map((coffee) => coffee.origin))];
  const processes = [...new Set(coffees.map((coffee) => coffee.process))];
  const certifications = [
    ...new Set(coffees.flatMap((coffee) => coffee.certifications)),
  ];
  const statuses = [
    ...new Set(
      coffees.flatMap((coffee) => coffee.offers.map((offer) => offer.status)),
    ),
  ];

  const filtered = useMemo(() => {
    const result = coffees.filter((coffee) => {
      const haystack = [
        coffee.name[locale],
        coffee.origin,
        coffee.region[locale],
        coffee.process,
        ...coffee.sensory.map((x) => x[locale]),
        ...coffee.certifications,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!filters.query || haystack.includes(filters.query.toLowerCase())) &&
        (filters.category === "all" || coffee.category === filters.category) &&
        (filters.origin === "all" || coffee.origin === filters.origin) &&
        (filters.process === "all" || coffee.process === filters.process) &&
        (filters.location === "all" ||
          coffee.offers.some(
            (offer) => offer.warehouse === filters.location,
          )) &&
        (filters.certification === "all" ||
          coffee.certifications.includes(filters.certification)) &&
        (filters.status === "all" ||
          coffee.offers.some((offer) => offer.status === filters.status))
      );
    });
    return result.sort((a, b) =>
      sort === "score"
        ? (b.score ?? 0) - (a.score ?? 0)
        : sort === "bags"
          ? b.offers.reduce((n, o) => n + o.bagsAvailable, 0) -
            a.offers.reduce((n, o) => n + o.bagsAvailable, 0)
          : a.name[locale].localeCompare(b.name[locale]),
    );
  }, [coffees, filters, locale, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * pageSize,
    Math.min(page, pages) * pageSize,
  );
  const update = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clear = () => {
    setFilters(initialFilters);
    setPage(1);
  };
  const activeCount = Object.entries(filters).filter(([key, value]) =>
    key === "query" ? value : value !== "all",
  ).length;

  return (
    <div>
      <div className="sticky top-[72px] z-20 border-y border-border bg-background/95 backdrop-blur-xl">
        <div className="site-container flex flex-col gap-3 py-4 lg:flex-row lg:items-end">
          <label className="relative flex-1">
            <span className="sr-only">{labels.search}</span>
            <Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filters.query}
              onChange={(event) => update("query", event.target.value)}
              placeholder={labels.search}
              className="h-12 w-full rounded-xl border border-input bg-card pe-4 ps-11 text-sm outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {["all", "specialty", "commercial"].map((value) => (
              <button
                key={value}
                onClick={() => update("category", value)}
                className={cn(
                  "h-11 whitespace-nowrap rounded-full border px-5 text-sm font-bold transition",
                  filters.category === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-gold",
                )}
              >
                {labels[value as "all" | "specialty" | "commercial"]}
              </button>
            ))}
            <button
              onClick={() => setFiltersOpen((value) => !value)}
              className="flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-5 text-sm font-bold hover:border-gold"
            >
              <SlidersHorizontal className="size-4" />
              {labels.filters}
              {activeCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-gold text-[10px] text-[#17251c]">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="site-container grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-6">
                <SelectFilter
                  allLabel={allLabel}
                  label={labels.origin}
                  value={filters.origin}
                  options={origins}
                  onChange={(value) => update("origin", value)}
                />
                <SelectFilter
                  allLabel={allLabel}
                  label={labels.process}
                  value={filters.process}
                  options={processes}
                  onChange={(value) => update("process", value)}
                />
                <SelectFilter
                  allLabel={allLabel}
                  label={labels.location}
                  value={filters.location}
                  options={["Egypt", "Dubai"]}
                  onChange={(value) => update("location", value)}
                />
                <SelectFilter
                  allLabel={allLabel}
                  label={labels.certification}
                  value={filters.certification}
                  options={certifications}
                  onChange={(value) => update("certification", value)}
                />
                <SelectFilter
                  allLabel={allLabel}
                  label={labels.availability}
                  value={filters.status}
                  options={statuses}
                  onChange={(value) => update("status", value)}
                />
                <button
                  onClick={clear}
                  className="mt-auto h-11 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-gold hover:text-gold"
                >
                  {labels.reset}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="site-container py-10">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {labels.showing.replace("{count}", String(filtered.length))}
          </p>
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {labels.sort}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground"
            >
              <option value="name">A–Z</option>
              <option value="score">
                {locale === "ar" ? "تقييم الكوب" : "Cup score"}
              </option>
              <option value="bags">
                {locale === "ar" ? "الأكياس المتاحة" : "Bags available"}
              </option>
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-input py-24 text-center">
            <p className="font-heading text-3xl">{labels.noResults}</p>
            <button
              onClick={clear}
              className="mt-5 text-sm font-bold text-gold"
            >
              {labels.reset}
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="hidden grid-cols-[1.45fr_.9fr_.9fr_.9fr_auto] gap-5 border-b border-border bg-muted/70 px-6 py-3 text-[.68rem] font-bold uppercase tracking-[.14em] text-muted-foreground md:grid">
              <span>{labels.coffee}</span>
              <span>{labels.profile}</span>
              <span>{labels.offer}</span>
              <span>{labels.availability}</span>
              <span className="w-8" />
            </div>
            {visible.map((coffee) => (
              <div
                key={coffee.id}
                className="border-b border-border last:border-b-0"
              >
                <button
                  onClick={() =>
                    setExpanded(expanded === coffee.id ? null : coffee.id)
                  }
                  className="grid w-full grid-cols-[1fr_auto] gap-5 px-5 py-5 text-start transition hover:bg-muted/40 md:grid-cols-[1.45fr_.9fr_.9fr_.9fr_auto] md:items-center md:px-6"
                >
                  <span className="flex items-center gap-4">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: coffee.color }}
                    />
                    <span>
                      <strong className="block font-heading text-xl font-semibold">
                        {coffee.name[locale]}
                      </strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {coffee.origin} · {coffee.process} ·{" "}
                        {coffee.score ?? "—"}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground md:block">
                    {coffee.sensory
                      .slice(0, 2)
                      .map((note) => note[locale])
                      .join(" · ")}
                  </span>
                  <span className="hidden text-sm md:flex md:items-center md:gap-2">
                    <MapPin className="size-4 text-gold" />
                    {[
                      ...new Set(coffee.offers.map((offer) => offer.warehouse)),
                    ].join(" · ")}
                  </span>
                  <span className="hidden md:flex md:flex-wrap md:gap-1.5">
                    {[
                      ...new Set(coffee.offers.map((offer) => offer.status)),
                    ].map((status) => (
                      <span
                        key={status}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[.68rem] font-bold",
                          status === "Available"
                            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                            : status === "Limited"
                              ? "bg-gold/15 text-[#8a5d1f] dark:text-gold-bright"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {status}
                      </span>
                    ))}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 transition duration-300",
                      expanded === coffee.id && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded === coffee.id && (
                    <motion.div
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduced ? undefined : { height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border bg-page/70 px-5 py-6 md:px-10">
                        <div className="grid gap-5 lg:grid-cols-[.9fr_1.6fr]">
                          <div>
                            <p className="eyebrow">{labels.details}</p>
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                              {coffee.cupNote[locale]}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {coffee.certifications.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-border bg-card px-3 py-1 text-xs"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-2">
                            {coffee.offers.map((offer) => (
                              <div
                                key={offer.id}
                                className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"
                              >
                                <span className="text-sm">
                                  <strong className="block">
                                    {offer.warehouse}
                                  </strong>
                                  <small className="text-muted-foreground">
                                    {offer.reference}
                                  </small>
                                </span>
                                <span className="text-sm">
                                  <strong>{offer.bagsAvailable}</strong>{" "}
                                  {labels.bags}
                                  <small className="block text-muted-foreground">
                                    {offer.bagWeightKg} kg · {offer.packaging}
                                  </small>
                                </span>
                                <span className="text-sm font-bold">
                                  {offer.price ?? labels.pricing}
                                </span>
                                <Link
                                  href={`/products/${coffee.slug}`}
                                  className="rounded-full bg-primary px-4 py-2 text-center text-xs font-bold text-primary-foreground"
                                >
                                  {labels.view}
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid size-10 place-items-center rounded-full border border-border disabled:opacity-30"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <span className="text-sm font-bold">
              {Math.min(page, pages)} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="grid size-10 place-items-center rounded-full border border-border disabled:opacity-30"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
