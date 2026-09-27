"use client";

import Image from "next/image";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { OriginMap } from "@/lib/origin-maps";
import { cn } from "@/lib/utils";

export type OriginRowData = {
  id: string;
  slug: string;
  name: string;
  lang?: string;
  countryCode?: string | null;
  continentLabel: string;
  coffeeCountLabel: string;
  summary?: string | null;
  media: { url: string; alt: string } | null;
  /** Resolved on the server so only the rendered outlines reach the client. */
  map: OriginMap;
};

const CARD_TONES = [
  "bg-[#b9d6bf] text-[#173c32]",
  "bg-[#21584d] text-primary-foreground",
  "bg-[#e5d39d] text-[#173c32]",
  "bg-[#638d75] text-primary-foreground",
];

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The outline itself: drawn straight onto the section's green, no card or
 * plate behind it. Unknown countries get a globe with the origin's initials
 * rather than an invented silhouette.
 */
function OriginMapGraphic({
  map,
  className,
}: {
  map: OriginMap;
  className?: string;
}) {
  if (!map.mapPath) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className={cn("origin-map-svg", className)}
      >
        <circle cx="50" cy="50" r="42" className="origin-map-land" />
        <ellipse cx="50" cy="50" rx="18" ry="42" className="origin-map-grid" />
        <ellipse cx="50" cy="50" rx="42" ry="15" className="origin-map-grid" />
        <path d="M8 50h84M50 8v84" className="origin-map-grid" />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="origin-map-initials"
        >
          {map.code}
        </text>
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn("origin-map-svg", className)}
    >
      <path d={map.mapPath} className="origin-map-land" />
      {map.marker ? (
        <g className="origin-map-marker">
          <circle cx={map.marker[0]} cy={map.marker[1]} r="4.2" />
          <circle cx={map.marker[0]} cy={map.marker[1]} r="1.5" />
        </g>
      ) : null}
    </svg>
  );
}

/**
 * Origins as a two-column, scroll-linked read on desktop: the cards scroll
 * normally on the right while a sticky column on the left shows only the
 * active origin's number and a large country outline. On phones and tablets
 * every origin simply carries its own number and map above its card, in
 * normal flow — nothing sticky, nothing pinned.
 *
 * The active origin is whichever card crosses the viewport's horizontal
 * centre line, found with one IntersectionObserver whose root margin
 * collapses the viewport to that line. It only fires when a card crosses
 * it, in either direction, and then resolves the card nearest the line so a
 * fast fling that skips a card still settles on the right one. No scroll
 * listener, no per-frame work, and React re-renders only when the active
 * origin actually changes. The sticky column is plain CSS, so it releases
 * naturally at the end of the section and never traps the page.
 */
export function OriginScrollList({
  origins,
  eyebrow,
  title,
  intro,
}: {
  origins: OriginRowData[];
  eyebrow: string;
  title: string;
  intro: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (origins.length < 2 || !("IntersectionObserver" in window)) return;

    const settle = () => {
      const line = window.innerHeight / 2;
      let nearest = -1;
      let best = Number.POSITIVE_INFINITY;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const distance =
          line < rect.top
            ? rect.top - line
            : line > rect.bottom
              ? line - rect.bottom
              : 0;
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      if (nearest >= 0) setActiveIndex(nearest);
    };

    const observer = new IntersectionObserver(settle, {
      rootMargin: "-50% 0px -50% 0px",
      threshold: 0,
    });
    for (const card of cardRefs.current) if (card) observer.observe(card);
    return () => observer.disconnect();
  }, [origins.length]);

  const count = origins.length;

  return (
    <div className="site-container">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-16">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display-lg mt-5 max-w-[13ch]">{title}</h2>
        </div>
        <p className="max-w-[40ch] text-base leading-7 text-white/72 lg:pb-2 lg:text-lg lg:leading-8">
          {intro}
        </p>
      </div>

      <div className="mt-12 grid lg:mt-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 xl:gap-24">
        {/* Desktop sticky visual. Decorative: every fact it shows is in the
            card it points at, so it is hidden from assistive technology. */}
        <div aria-hidden="true" className="relative hidden lg:block">
          <div className="origin-stage sticky top-[calc(var(--site-header-h)+1.5rem)] flex h-[calc(100svh-var(--site-header-h)-3rem)] max-h-[46rem] min-h-[30rem] flex-col">
            <div className="flex items-start gap-4">
              <span className="origin-odometer">
                <span
                  className="origin-odometer-track"
                  style={{ transform: `translateY(${-activeIndex * 1.1}em)` }}
                >
                  {origins.map((origin, index) => (
                    <span key={origin.id}>{pad(index + 1)}</span>
                  ))}
                </span>
              </span>
              <span className="mt-3 font-mono text-xs font-bold tracking-[0.2em] text-white/45">
                / {pad(count)}
              </span>
            </div>

            <div className="relative mt-4 min-h-0 flex-1">
              {origins.map((origin, index) => (
                <div
                  key={origin.id}
                  className="origin-stage-map absolute inset-0 flex flex-col"
                  data-active={index === activeIndex}
                >
                  <OriginMapGraphic
                    map={origin.map}
                    className="min-h-0 w-full flex-1"
                  />
                  <p className="mt-4 flex items-center gap-3 font-mono text-xs font-bold tracking-[0.2em] text-gold-bright/85">
                    <span>{origin.map.code}</span>
                    <span
                      aria-hidden="true"
                      className="h-px w-8 bg-current opacity-50"
                    />
                    <span>{origin.map.coordinates}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-14 sm:gap-16 lg:gap-8 lg:pb-[16svh]">
          {origins.map((origin, index) => {
            const active = index === activeIndex;
            const tone = index % CARD_TONES.length;
            const light = tone === 0 || tone === 2;
            return (
              <li
                key={origin.id}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-origin-index={index}
              >
                {/* Phones and tablets: this origin's own number and map, in
                    flow, directly above its card. */}
                <div
                  aria-hidden="true"
                  className="mb-5 flex items-end justify-between gap-6 lg:hidden"
                >
                  <div>
                    <span className="block font-heading text-6xl leading-none font-light text-gold-contrast sm:text-7xl">
                      {pad(index + 1)}
                    </span>
                    <span className="mt-3 block font-mono text-[0.68rem] font-bold tracking-[0.2em] text-gold-bright/85">
                      {origin.map.code} · {origin.map.coordinates}
                    </span>
                  </div>
                  <OriginMapGraphic
                    map={origin.map}
                    className="size-36 shrink-0 sm:size-44"
                  />
                </div>

                <Link
                  href={`/coffee-origins/${origin.slug}`}
                  className={cn(
                    "home-reveal-item group relative isolate flex min-h-[23rem] overflow-hidden rounded-[1.6rem] outline-none ring-1 ring-black/5 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-primary sm:min-h-[25rem] lg:min-h-[27rem] lg:hover:-translate-y-1 lg:hover:shadow-[0_30px_80px_rgb(2_20_14/.38)]",
                    CARD_TONES[tone],
                    "lg:bg-[#21584d] lg:text-primary-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="absolute -inset-6 -z-10 rotate-[-3deg] overflow-hidden"
                  >
                    {origin.media ? (
                      <Image
                        src={origin.media.url}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, min(46rem, 52vw)"
                        className={cn(
                          "object-cover transition-[opacity,transform] duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none lg:group-hover:scale-[1.06]",
                          active
                            ? "scale-100 opacity-100"
                            : "opacity-100 lg:scale-[1.03] lg:opacity-40 lg:group-hover:opacity-70",
                        )}
                      />
                    ) : (
                      <span
                        className="highlight-fallback absolute inset-0"
                        data-tone={tone}
                      />
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 -z-10",
                      light
                        ? "bg-gradient-to-br from-white/88 via-white/52 to-[#e2cf97]/72 lg:from-[#0e332a]/86 lg:via-[#123c32]/62 lg:to-[#0e332a]/34"
                        : "bg-gradient-to-br from-[#0e332a]/86 via-[#123c32]/62 to-[#0e332a]/34",
                    )}
                  />

                  <span className="relative flex w-full flex-col justify-between p-7 sm:p-9 lg:p-11">
                    <span className="flex items-start justify-between gap-5">
                      <span
                        className={cn(
                          "font-mono text-sm font-bold tabular-nums",
                          light ? "text-[#a44819] lg:text-gold-bright" : "text-gold-bright",
                        )}
                      >
                        {pad(index + 1)}
                      </span>
                      <ArrowUpRight
                        className={cn(
                          "size-5 shrink-0 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1",
                          light ? "text-[#a44819] lg:text-gold-bright" : "text-gold-bright",
                        )}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="max-w-[30rem]">
                      <span
                        lang={origin.lang}
                        className={cn(
                          "display-title block text-5xl sm:text-6xl lg:text-[4.25rem]",
                          light ? "text-[#173c32] lg:text-primary-foreground" : "text-primary-foreground",
                        )}
                      >
                        {origin.name}
                      </span>
                      {origin.summary ? (
                        <span
                          className={cn(
                            "mt-5 block max-w-[44ch] text-base leading-7",
                            light ? "text-[#173c32]/72 lg:text-white/78" : "text-white/78",
                          )}
                        >
                          {origin.summary}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold",
                          light ? "text-[#173c32]/78 lg:text-white/80" : "text-white/80",
                        )}
                      >
                        <Globe2
                          className={cn(
                            "size-4",
                            light ? "text-[#a44819] lg:text-gold-bright" : "text-gold-bright",
                          )}
                          aria-hidden="true"
                        />
                        <span>{origin.continentLabel}</span>
                        <span aria-hidden="true" className="opacity-45">
                          /
                        </span>
                        <span>{origin.coffeeCountLabel}</span>
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
