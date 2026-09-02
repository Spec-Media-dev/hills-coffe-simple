"use client";

import { ChevronDown, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MegaMenuReveal,
  NavUnderline,
} from "@/components/motion/primitives";
import { Link } from "@/i18n/navigation";

export function CatalogMegaMenu({
  labels,
}: {
  labels: {
    trigger: string;
    all: string;
    specialty: string;
    commercial: string;
    origins: string;
    egypt: string;
    dubai: string;
    pricing: string;
  };
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
      <button
        type="button"
        className="flex min-h-11 items-center gap-1.5 text-sm font-semibold"
        aria-expanded={open}
        aria-controls="catalog-mega-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <NavUnderline>{labels.trigger}</NavUnderline>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <MegaMenuReveal className="absolute top-[calc(100%-1px)] start-1/2 z-50 w-[min(760px,calc(100vw-3rem))] -translate-x-1/2">
            <nav
              id="catalog-mega-menu"
              aria-label={labels.trigger}
              className="grid grid-cols-[1.05fr_.95fr] overflow-hidden border border-border bg-card shadow-[0_28px_80px_rgb(23_60_50/.2)]"
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
              <div className="grid content-start p-4 text-sm">
                <Link
                  href="/coffee-origins"
                  onClick={() => setOpen(false)}
                  className="border-b border-border px-4 py-4 font-bold hover:bg-muted"
                >
                  {labels.origins}
                </Link>
                <Link
                  href="/green-coffee-offer-list?location=EGYPT"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b border-border px-4 py-4 hover:bg-muted"
                >
                  <MapPin
                    className="size-4 text-highlight"
                    aria-hidden="true"
                  />
                  {labels.egypt}
                </Link>
                <Link
                  href="/green-coffee-offer-list?location=DUBAI"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b border-border px-4 py-4 hover:bg-muted"
                >
                  <MapPin
                    className="size-4 text-highlight"
                    aria-hidden="true"
                  />
                  {labels.dubai}
                </Link>
                <Link
                  href="/green-coffee-offer-list"
                  onClick={() => setOpen(false)}
                  className="mt-3 bg-gold px-4 py-3 font-bold text-[#17251c] hover:bg-gold-bright"
                >
                  {labels.all} →
                </Link>
              </div>
            </nav>
          </MegaMenuReveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
