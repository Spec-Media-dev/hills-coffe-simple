"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { AccordionExpand } from "@/components/motion/primitives";

export function FilterPanel({
  children,
  label,
  activeCount,
}: {
  children: React.ReactNode;
  label: string;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
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
          {label}
          {activeCount ? (
            <span className="grid size-6 place-items-center rounded-full bg-highlight text-xs text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        {open ? <X className="size-4" aria-hidden="true" /> : null}
      </button>
      <div className="hidden md:block">{children}</div>
      <AccordionExpand open={open} className="md:hidden">
        <div id="catalog-filter-panel" className="pt-3">
          {children}
        </div>
      </AccordionExpand>
    </div>
  );
}
