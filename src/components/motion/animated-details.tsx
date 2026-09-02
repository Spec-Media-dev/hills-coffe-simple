"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { AccordionExpand } from "./primitives";

export function AnimatedDetails({
  summary,
  lang,
  children,
}: {
  summary: string;
  lang: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-start text-lg font-bold"
        aria-expanded={open}
        aria-controls={id}
      >
        <span lang={lang}>{summary}</span>
        <ChevronDown
          className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <AccordionExpand open={open}>
        <div id={id} className="pb-6 pe-12">
          {children}
        </div>
      </AccordionExpand>
    </div>
  );
}
