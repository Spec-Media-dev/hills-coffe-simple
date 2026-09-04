"use client";

import { ArrowRight, ChevronDown, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MegaMenuReveal,
  NavUnderline,
} from "@/components/motion/primitives";
import { Link } from "@/i18n/navigation";

export function CatalogMegaMenu({
  labels,
  origins,
}: {
  labels: {
    trigger: string;
    all: string;
    specialty: string;
    commercial: string;
    productsMenu: string;
    origins: string;
    originsAll: string;
    location: string;
    egypt: string;
    dubai: string;
    pricing: string;
  };
  /** Real active origins, already localized, from the catalog facet source. */
  origins: { slug: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-20 items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {/*
       * A link plus a disclosure button, not one button doing both jobs.
       *
       * "Products" is the catalog, and clicking it should go there — the
       * header previously satisfied that only by accident, through a search
       * icon that pointed at the catalog, and converting that icon into real
       * search removed the only direct route in the header. Splitting the
       * trigger restores it without making the panel unreachable: the panel
       * still opens on hover, and the chevron gives keyboard users an explicit
       * control with its own accessible name.
       */}
      <Link
        href="/green-coffee-offer-list"
        className="flex min-h-11 items-center text-sm font-semibold"
      >
        <NavUnderline>{labels.trigger}</NavUnderline>
      </Link>
      <button
        type="button"
        className="grid min-h-11 place-items-center px-1"
        aria-expanded={open}
        aria-controls="catalog-mega-menu"
        aria-label={labels.productsMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open ? (
          /*
           * `start-1/2` is logical — it resolves to `right: 50%` under RTL —
           * but `translate-x` is physical and always moves left. Together they
           * cancel in LTR and compound in RTL, which put the Arabic panel 760px
           * from its trigger with its leading edge at roughly -204px, off the
           * side of the page. The RTL override flips the translate so the two
           * agree in both directions.
           */
          <MegaMenuReveal className="absolute top-[calc(100%-1px)] start-1/2 z-50 w-[min(720px,calc(100vw-3rem))] -translate-x-1/2 rtl:translate-x-1/2">
            <nav
              id="catalog-mega-menu"
              aria-label={labels.trigger}
              className="grid grid-cols-[1.22fr_1fr] overflow-hidden border border-border bg-card shadow-[0_28px_80px_rgb(23_60_50/.2)]"
            >
              <div className="bg-primary p-7 text-primary-foreground">
                <p className="eyebrow !text-gold-contrast">{labels.trigger}</p>
                <Link
                  href="/green-coffee-offer-list"
                  onClick={() => setOpen(false)}
                  className="mt-10 block font-heading text-4xl leading-none"
                >
                  {labels.all}
                </Link>
                <div className="mt-8 flex flex-wrap gap-2 text-xs">
                  <span className="border border-white/20 px-3 py-2">
                    {labels.specialty}
                  </span>
                  <span className="border border-white/20 px-3 py-2">
                    {labels.commercial}
                  </span>
                </div>
                <p className="mt-8 flex items-center gap-2 text-xs text-white/65">
                  <ShieldCheck
                    className="size-4 text-gold-bright"
                    aria-hidden="true"
                  />
                  {labels.pricing}
                </p>
              </div>
              {/* Rows are flush to the panel edge and share the left column's
                  vertical rhythm, so the two halves read as one object. */}
              <div className="grid content-start py-5 text-sm">
                <Link
                  href="/coffee-origins"
                  onClick={() => setOpen(false)}
                  className="border-b border-border px-6 py-4 font-bold transition-colors hover:bg-muted focus-visible:bg-muted"
                >
                  {labels.origins}
                </Link>
                {/*
                 * Real origins, straight from the catalog facets, so this menu
                 * can never offer an origin the filter would reject. Capped,
                 * with a link to the full index — a long list would push the
                 * panel past the viewport.
                 */}
                {origins.slice(0, 6).map((origin) => (
                  <Link
                    key={origin.slug}
                    href={`/green-coffee-offer-list?origin=${origin.slug}`}
                    onClick={() => setOpen(false)}
                    className="border-b border-border px-6 py-3.5 transition-colors hover:bg-muted focus-visible:bg-muted"
                  >
                    {origin.label}
                  </Link>
                ))}
                {origins.length > 6 ? (
                  <Link
                    href="/coffee-origins"
                    onClick={() => setOpen(false)}
                    className="border-b border-border px-6 py-3.5 font-bold text-highlight transition-colors hover:bg-muted focus-visible:bg-muted"
                  >
                    {labels.originsAll}
                  </Link>
                ) : null}

                {/*
                 * Warehouses, kept visibly apart from origins. Egypt and Dubai
                 * are where coffee is *held*, not where it is grown, and the
                 * two were previously listed together as if they were the same
                 * kind of thing.
                 */}
                <p className="eyebrow px-6 pb-2 pt-5">{labels.location}</p>
                {[
                  { href: "?location=EGYPT", label: labels.egypt },
                  { href: "?location=DUBAI", label: labels.dubai },
                ].map((entry) => (
                  <Link
                    key={entry.href}
                    href={`/green-coffee-offer-list${entry.href}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 border-b border-border px-6 py-3.5 transition-colors hover:bg-muted focus-visible:bg-muted"
                  >
                    <MapPin
                      className="size-4 shrink-0 text-highlight"
                      aria-hidden="true"
                    />
                    {entry.label}
                  </Link>
                ))}
                <Link
                  href="/green-coffee-offer-list"
                  onClick={() => setOpen(false)}
                  className="mx-6 mt-5 flex items-center justify-between gap-3 bg-gold px-4 py-3 font-bold text-[#17251c] transition-colors hover:bg-gold-bright"
                >
                  {labels.all}
                  {/* An icon, not a literal "→": the character cannot mirror,
                      so in Arabic it pointed the wrong way. */}
                  <ArrowRight
                    className="size-4 shrink-0 rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </nav>
          </MegaMenuReveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
