"use client";

import Image from "next/image";
import { ArrowUpRight, PackageOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type CoffeeHighlight = {
  id: string;
  slug: string;
  name: string;
  nameLang?: string;
  origin: string;
  process: string | null;
  cupScore: number | null;
  bags: number;
  warehouse: string;
  media: { url: string; alt: string } | null;
};

const CARD_TONES = [
  "bg-[#17483d] text-primary-foreground",
  "bg-[#245548] text-primary-foreground",
  "bg-[#e4d19a] text-foreground",
  "bg-[#2a6250] text-primary-foreground",
];

/**
 * A deliberately small client boundary around the catalogue's editorial
 * highlights. The list content and every link still render on the server;
 * JavaScript only chooses the currently read card on large screens.
 *
 * IntersectionObserver is used instead of a scroll listener, so the active
 * card follows natural reading position without running work on every scroll
 * event. Hover and keyboard focus use that same active state to reveal the
 * coffee photograph immediately.
 */
export function CoffeeHighlightList({
  coffees,
  bagsLabel,
  viewLabel,
}: {
  coffees: CoffeeHighlight[];
  bagsLabel: string;
  viewLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (coffees.length < 2) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    if (!desktop.matches || !("IntersectionObserver" in window)) return;

    const visibility = new Map<number, number>();
    let frame = 0;
    const settleActiveCard = () => {
      frame = 0;
      let next = activeIndex;
      let greatest = 0;
      for (const [index, ratio] of visibility) {
        if (ratio > greatest) {
          greatest = ratio;
          next = index;
        }
      }
      if (greatest > 0) setActiveIndex(next);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(
            (entry.target as HTMLElement).dataset.highlightIndex,
          );
          visibility.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }
        if (!frame) frame = window.requestAnimationFrame(settleActiveCard);
      },
      { rootMargin: "-22% 0px -32%", threshold: [0, 0.3, 0.55, 0.8] },
    );

    for (const card of cardRefs.current) if (card) observer.observe(card);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
    // The observer is deliberately created once for this rendered coffee set.
    // `activeIndex` is only its initial fallback, not an input to observation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coffees.length]);

  return (
    <ul className="mt-10 flex flex-col gap-3 lg:mt-14 lg:gap-4">
      {coffees.map((coffee, index) => {
        const active = activeIndex === index;
        const light = index % CARD_TONES.length === 2;
        return (
          <li key={coffee.id}>
            <Link
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              data-highlight-index={index}
              href={`/green-coffee-offer-list/${coffee.slug}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              className={cn(
                "group relative isolate flex overflow-hidden rounded-[1.4rem] outline-none ring-1 ring-black/5 transition-[min-height,transform,box-shadow] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-background lg:will-change-transform",
                active
                  ? "min-h-[20rem] shadow-[0_24px_64px_rgb(13_42_33/.22)] lg:min-h-[24rem]"
                  : "min-h-[10.25rem] lg:min-h-[11.5rem] lg:hover:-translate-y-1",
                CARD_TONES[index % CARD_TONES.length],
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 -z-10 overflow-hidden transition-opacity duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                {coffee.media ? (
                  <Image
                    src={coffee.media.url}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, min(78rem, 90vw)"
                    className="object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="surface-noise absolute inset-0 bg-primary" />
                )}
                <span className="absolute inset-0 bg-gradient-to-r from-[#102e26]/95 via-[#102e26]/72 via-[52%] to-[#102e26]/26 rtl:bg-gradient-to-l" />
              </span>

              <span className="relative flex w-full flex-col justify-between gap-7 p-6 sm:p-8 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:px-10 lg:py-8">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    active || !light ? "text-gold-contrast" : "text-highlight",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        "eyebrow",
                        active || !light
                          ? "!text-gold-contrast"
                          : "!text-highlight",
                      )}
                    >
                      {coffee.origin}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        active || !light
                          ? "text-white/85"
                          : "text-foreground/65",
                      )}
                    >
                      {[coffee.process, coffee.cupScore]
                        .filter((value) => value !== null && value !== "")
                        .join(" · ")}
                    </span>
                  </span>
                  <span
                    lang={coffee.nameLang}
                    className={cn(
                      "mt-3 block max-w-[24ch] font-heading font-extrabold tracking-[-0.03em] transition-[font-size] duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
                      active
                        ? "text-4xl leading-[1.02] sm:text-5xl lg:text-6xl"
                        : "text-2xl leading-tight lg:text-3xl",
                    )}
                  >
                    {coffee.name}
                  </span>
                </span>

                <span
                  className={cn(
                    "flex shrink-0 flex-col gap-4 text-sm lg:items-end lg:text-end",
                    active || !light ? "text-white/90" : "text-foreground/78",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <PackageOpen
                      className={cn(
                        "size-4 shrink-0",
                        active || !light
                          ? "text-gold-contrast"
                          : "text-highlight",
                      )}
                      aria-hidden="true"
                    />
                    {coffee.bags} {bagsLabel} · {coffee.warehouse}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 font-bold",
                      active || !light
                        ? "text-gold-contrast"
                        : "text-highlight",
                    )}
                  >
                    {viewLabel}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
