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

function OriginMapGlyph({
  treatment,
  className = "size-28 text-gold-bright sm:size-32",
}: {
  treatment: OriginTreatment;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 104 104"
      className={cn("shrink-0", className)}
    >
      <path
        d={treatment.mapPath}
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle
        cx={treatment.marker[0]}
        cy={treatment.marker[1]}
        r="4"
        fill="currentColor"
      />
      <circle
        cx={treatment.marker[0]}
        cy={treatment.marker[1]}
        r="8"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Every origin is rendered in the server HTML. This client boundary tracks the
 * active origin to drive the contextual map card on desktop, while on mobile
 * each card carries its own corresponding map graphic directly.
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
  const [activeId, setActiveId] = useState<string>(origins[0]?.id ?? "");
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeOrigin = origins.find((o) => o.id === activeId) ?? origins[0];
  const activeTreatment = activeOrigin ? treatmentFor(activeOrigin) : null;

  useEffect(() => {
    if (origins.length < 2) return;

    let ticking = false;

    const checkActiveCard = () => {
      ticking = false;
      // On desktop (lg:), cards stick and stack as the user scrolls down.
      // A card is active once its top reaches or passes the sticky activation zone (~180px).
      // We find the highest index whose top <= activationZone.
      const activationZone = 180;
      let nextIndex = 0;

      for (let i = 0; i < origins.length; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        if (rect.top <= activationZone) {
          nextIndex = i;
        }
      }

      const nextOrigin = origins[nextIndex];
      if (nextOrigin) {
        setActiveId(nextOrigin.id);
      }
    };

    const onScrollOrResize = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(checkActiveCard);
      }
    };

    onScrollOrResize();

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [origins]);

  if (!activeOrigin || !activeTreatment) return null;

  return (
    <div className="site-container grid gap-10 lg:grid-cols-[minmax(19rem,.78fr)_minmax(0,1.22fr)] lg:gap-14 xl:gap-20">
      <div className="lg:hidden">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display-lg mt-5 max-w-[12ch]">{title}</h2>
        <p className="mt-5 max-w-[34ch] text-base leading-7 text-muted-foreground">
          {intro}
        </p>
      </div>

      <aside className="origin-map-field relative isolate hidden min-h-[29rem] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#10382f] p-7 text-primary-foreground shadow-[0_28px_80px_rgb(4_22_16/.3)] sm:p-10 lg:sticky lg:top-28 lg:block lg:h-[calc(100svh-9rem)] lg:min-h-[35rem]">
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
          <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[1.4rem] border border-white/20 bg-[#0a2b23]/80 p-6 backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-xs font-bold tracking-[0.2em] text-gold-bright">
                {activeTreatment.coordinates}
              </span>
              <span className="mt-3 block font-heading text-5xl leading-none font-extrabold tracking-[-0.05em] text-white sm:text-6xl">
                {activeTreatment.code}
              </span>
              <span
                lang={activeOrigin.lang}
                className="mt-2 block truncate text-base font-semibold text-white/90 sm:text-lg"
              >
                {activeOrigin.name}
              </span>
            </div>
            <div className="shrink-0">
              <OriginMapGlyph
                treatment={activeTreatment}
                className="size-24 text-gold-bright sm:size-28"
              />
            </div>
          </div>
        </div>
      </aside>

      <ul className="relative flex flex-col gap-5 pb-4 lg:gap-[7rem] lg:pb-[16rem]">
        {origins.map((origin, index) => {
          const active = activeOrigin.id === origin.id;
          const treatment = treatmentFor(origin);
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
                onMouseEnter={() => setActiveId(origin.id)}
                onFocus={() => setActiveId(origin.id)}
                className={cn(
                  "group relative isolate flex min-h-[25rem] overflow-hidden rounded-[1.6rem] outline-none ring-1 ring-black/5 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-primary sm:min-h-[26rem] lg:min-h-[30rem] lg:will-change-transform lg:hover:-translate-y-1 lg:hover:shadow-[0_30px_80px_rgb(2_20_14/.38)]",
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
                    <span className="flex items-center gap-3">
                      <span className="block lg:hidden">
                        <OriginMapGlyph
                          treatment={treatment}
                          className={cn(
                            "size-14 sm:size-16",
                            light ? "text-highlight" : "text-gold-bright",
                          )}
                        />
                      </span>
                      <ArrowUpRight
                        className={cn(
                          "size-5 shrink-0 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1",
                          light ? "text-highlight" : "text-gold-bright",
                        )}
                        aria-hidden="true"
                      />
                    </span>
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
