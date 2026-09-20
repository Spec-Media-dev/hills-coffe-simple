"use client";

import Image from "next/image";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
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
};

type OriginTreatment = {
  code: string;
  coordinates: string;
  mapPath: string;
  marker: [number, number];
};

const COUNTRY_TREATMENTS: Record<string, OriginTreatment> = {
  ET: {
    code: "ETH",
    coordinates: "09° N · 40° E",
    mapPath:
      "M44 5 67 9 84 22 97 43 89 59 96 77 77 96 53 94 35 99 16 82 7 61 15 40 28 24Z",
    marker: [57, 51],
  },
  BR: {
    code: "BRA",
    coordinates: "14° S · 52° W",
    mapPath: "M36 4 65 10 86 27 99 56 84 85 61 100 36 94 15 76 2 51 16 25Z",
    marker: [54, 54],
  },
};

const CARD_TONES = [
  "bg-[#b9d6bf] text-foreground",
  "bg-[#21584d] text-primary-foreground",
  "bg-[#e5d39d] text-foreground",
  "bg-[#638d75] text-primary-foreground",
];

function treatmentFor(origin: OriginRowData): OriginTreatment {
  const country = origin.countryCode?.toUpperCase();
  const known = country ? COUNTRY_TREATMENTS[country] : undefined;
  if (known) return known;
  const initials = origin.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return {
    code: initials || "OR",
    coordinates: origin.continentLabel,
    mapPath: "M44 5 73 14 96 42 84 78 56 98 20 84 4 51 18 22Z",
    marker: [53, 52],
  };
}

/**
 * Every origin is rendered in the server HTML. This small client boundary
 * only follows the card nearest the reading position. On desktop, each card
 * sticks a little lower and covers the last; phone layouts remain a normal,
 * readable list. IntersectionObserver avoids per-scroll JavaScript work.
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
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeOrigin = origins[activeIndex] ?? origins[0];
  const activeTreatment = activeOrigin ? treatmentFor(activeOrigin) : null;

  useEffect(() => {
    if (origins.length < 2 || !("IntersectionObserver" in window)) return;

    const visibility = new Map<number, number>();
    let frame = 0;
    const settleActiveCard = () => {
      frame = 0;
      let next = 0;
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
            (entry.target as HTMLElement).dataset.originIndex,
          );
          visibility.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }
        if (!frame) frame = window.requestAnimationFrame(settleActiveCard);
      },
      { rootMargin: "-20% 0px -28%", threshold: [0, 0.3, 0.55, 0.8] },
    );

    for (const card of cardRefs.current) if (card) observer.observe(card);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [origins.length]);

  if (!activeOrigin || !activeTreatment) return null;

  return (
    <div className="site-container grid gap-10 lg:grid-cols-[minmax(19rem,.78fr)_minmax(0,1.22fr)] lg:gap-14 xl:gap-20">
      <aside className="origin-map-field relative isolate min-h-[29rem] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#10382f] p-7 text-primary-foreground shadow-[0_28px_80px_rgb(4_22_16/.3)] sm:p-10 lg:sticky lg:top-28 lg:h-[calc(100svh-9rem)] lg:min-h-[35rem]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 overflow-hidden"
        >
          {activeOrigin.media ? (
            <Image
              src={activeOrigin.media.url}
              alt=""
              fill
              sizes="(min-width: 1024px) 35vw, 100vw"
              className="origin-map-image object-cover"
            />
          ) : null}
          <span className="absolute inset-0 bg-[#10382f]/85" />
        </div>
        <p className="eyebrow !text-gold-contrast">{eyebrow}</p>
        <h2 className="display-lg mt-5 max-w-[10ch]">{title}</h2>
        <p className="mt-5 max-w-[34ch] text-base leading-7 text-white/72">
          {intro}
        </p>

        <div className="absolute inset-x-7 bottom-7 sm:inset-x-10 sm:bottom-10">
          <div className="relative min-h-52 overflow-hidden rounded-[1.4rem] border border-white/20 bg-[#0a2b23]/55 p-5 backdrop-blur-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 104 104"
              className="absolute -end-3 -top-3 size-52 text-gold-bright/95 sm:-end-1 sm:size-56"
            >
              <path
                d={activeTreatment.mapPath}
                fill="currentColor"
                fillOpacity="0.18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <circle
                cx={activeTreatment.marker[0]}
                cy={activeTreatment.marker[1]}
                r="4"
                fill="currentColor"
              />
              <circle
                cx={activeTreatment.marker[0]}
                cy={activeTreatment.marker[1]}
                r="8"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1.5"
              />
            </svg>
            <span className="relative block font-mono text-xs font-bold tracking-[0.2em] text-gold-bright">
              {activeTreatment.coordinates}
            </span>
            <span className="relative mt-8 block font-heading text-6xl leading-none font-extrabold tracking-[-0.07em] sm:text-7xl">
              {activeTreatment.code}
            </span>
            <span
              lang={activeOrigin.lang}
              className="relative mt-3 block text-lg font-semibold"
            >
              {activeOrigin.name}
            </span>
          </div>
        </div>
      </aside>

      <ul className="relative flex flex-col gap-5 pb-4 lg:gap-[7rem] lg:pb-[16rem]">
        {origins.map((origin, index) => {
          const active = activeIndex === index;
          const light =
            index % CARD_TONES.length === 0 || index % CARD_TONES.length === 2;
          return (
            <li
              key={origin.id}
              className="lg:sticky"
              style={{
                top: `${6.5 + Math.min(index, 6) * 0.7}rem`,
                zIndex: index + 1,
              }}
            >
              <Link
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-origin-index={index}
                href={`/coffee-origins/${origin.slug}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "group relative isolate flex min-h-[21rem] overflow-hidden rounded-[1.6rem] outline-none ring-1 ring-black/5 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-primary sm:min-h-[23rem] lg:min-h-[30rem] lg:will-change-transform lg:hover:-translate-y-1 lg:hover:shadow-[0_30px_80px_rgb(2_20_14/.38)]",
                  CARD_TONES[index % CARD_TONES.length],
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute -inset-6 -z-10 overflow-hidden rotate-[-3deg]"
                >
                  {origin.media ? (
                    <Image
                      src={origin.media.url}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, min(58rem, 48vw)"
                      className={cn(
                        "object-cover transition-[opacity,transform] duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none lg:group-hover:scale-[1.06]",
                        active
                          ? "scale-100 opacity-100"
                          : "scale-[1.03] opacity-35",
                      )}
                    />
                  ) : (
                    <span className="surface-noise absolute inset-0 bg-primary" />
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 -z-10",
                    light
                      ? "bg-gradient-to-br from-white/88 via-white/52 to-[#e2cf97]/72"
                      : "bg-gradient-to-br from-[#0e332a]/86 via-[#123c32]/62 to-[#0e332a]/34",
                  )}
                />

                <span className="relative flex w-full flex-col justify-between p-7 sm:p-9 lg:p-11">
                  <span className="flex items-start justify-between gap-5">
                    <span
                      className={cn(
                        "font-mono text-sm font-bold tabular-nums",
                        light ? "text-highlight" : "text-gold-bright",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <ArrowUpRight
                      className={cn(
                        "size-5 shrink-0 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1",
                        light ? "text-highlight" : "text-gold-bright",
                      )}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="max-w-[28rem]">
                    <span
                      lang={origin.lang}
                      className={cn(
                        "block font-heading text-5xl leading-[.94] font-extrabold tracking-[-0.05em] sm:text-6xl lg:text-7xl",
                        light ? "text-foreground" : "text-primary-foreground",
                      )}
                    >
                      {origin.name}
                    </span>
                    {origin.summary ? (
                      <span
                        className={cn(
                          "mt-5 block max-w-[44ch] text-base leading-7",
                          light ? "text-foreground/70" : "text-white/75",
                        )}
                      >
                        {origin.summary}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold",
                        light ? "text-foreground/78" : "text-white/80",
                      )}
                    >
                      <Globe2
                        className={cn(
                          "size-4",
                          light ? "text-highlight" : "text-gold-bright",
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
  );
}
