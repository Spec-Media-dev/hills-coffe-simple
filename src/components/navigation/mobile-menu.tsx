"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

type Item = { href: string; label: string };

export function MobileMenu({
  items,
  openLabel,
  closeLabel,
}: {
  items: Item[];
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full border border-border"
        aria-expanded={open}
        aria-label={open ? closeLabel : openLabel}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-[73px] z-50 border-y border-border bg-background/98 px-5 py-7 shadow-2xl backdrop-blur-xl">
          <nav className="mx-auto flex max-w-3xl flex-col">
            {items.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b border-border py-4 text-xl font-medium"
              >
                <span>{item.label}</span>
                <span className="text-xs text-gold">0{index + 1}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
