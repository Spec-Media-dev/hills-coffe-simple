"use client";

import Image from "next/image";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SectionReveal } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

export type OriginRowData = {
  id: string;
  slug: string;
  name: string;
  lang?: string;
  continentLabel: string;
  coffeeCountLabel: string;
  summary?: string | null;
  media: { url: string; alt: string } | null;
};

/*
 * Origins as wide horizontal bands, after to-top.ch's "Was uns ausmacht" rows.
 *
 * The list is fully data-driven: whatever the caller passes renders, one band
 * per published origin, two or twenty. The only thing that cycles with the
 * index is presentation — a tint and a symmetric inset — so the stack has the
 * reference's loose, hand-placed rhythm without any row being special-cased.
 *
 * Hover or keyboard focus fades that origin's own hero image up *inside* the
 * band, behind the copy, under a wash that keeps the text readable. The band
 * never changes size: the image is an absolutely positioned layer at opacity
 * 0 → 1, so nothing around it moves. Below `lg` — where hover is not a
 * reliable signal — the image is simply always on, under the same wash.
 */
// Below `lg` every band shows its image under a dark wash, so the cream tint
// only applies from `lg` up, where it sits behind dark copy until hovered.
const TONES = [
  "bg-forest-light text-primary-foreground",
  "bg-[#5d8a72] text-primary-foreground",
  "bg-forest-light text-primary-foreground lg:bg-secondary lg:text-foreground",
  "bg-[#3a6b57] text-primary-foreground",
];
const INSETS = ["lg:mx-8", "lg:mx-0", "lg:mx-14", "lg:mx-4"];

export function OriginScrollList({ origins }: { origins: OriginRowData[] }) {
  if (!origins.length) return null;

  return (
    <ul className="mx-auto mt-12 flex w-full max-w-[78rem] flex-col gap-3 lg:mt-16 lg:gap-4">
      {origins.map((origin, index) => {
        const tone = TONES[index % TONES.length];
        const light = tone.includes("lg:text-foreground");
        return (
          <li key={origin.id} className={INSETS[index % INSETS.length]}>
            <SectionReveal delay={Math.min(index * 0.05, 0.3)}>
              <Link
                href={`/coffee-origins/${origin.slug}`}
                className={cn(
                  "group relative isolate flex min-h-[9.5rem] items-stretch overflow-hidden rounded-[1.25rem] ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(.22,1,.36,1)] focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f2a22] sm:min-h-[8.5rem] lg:min-h-[9rem] lg:rounded-2xl lg:will-change-transform lg:hover:z-10 lg:hover:-translate-y-1 lg:hover:scale-[1.028] lg:hover:rotate-[-0.2deg] lg:hover:shadow-[0_28px_70px_rgb(4_20_15/.42)] lg:focus-visible:z-10 lg:focus-visible:scale-[1.028]",
                  tone,
                )}
              >
                {/* The origin's own image, revealed in place. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 opacity-100 transition-opacity duration-700 ease-[cubic-bezier(.22,1,.36,1)] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
                >
                  {origin.media ? (
                    <Image
                      src={origin.media.url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 78rem, 100vw"
                      className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="surface-noise absolute inset-0 bg-primary" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-r from-[#0f2a22]/92 via-[#0f2a22]/62 to-[#0f2a22]/55 rtl:bg-gradient-to-l" />
                </span>

                <span
                  className={cn(
                    "relative flex w-full flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:gap-8 sm:px-8 lg:px-10",
                    // On the light band the text must survive the dark image
                    // wash coming up behind it.
                    light &&
                      "lg:group-hover:text-primary-foreground lg:group-focus-visible:text-primary-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-sm font-bold tabular-nums transition-colors duration-500",
                      light
                        ? "text-gold-bright lg:text-muted-foreground lg:group-hover:text-gold-bright lg:group-focus-visible:text-gold-bright"
                        : "text-gold-bright",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      lang={origin.lang}
                      className="block font-heading text-3xl leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem]"
                    >
                      {origin.name}
                    </span>
                    {origin.summary ? (
                      <span
                        className={cn(
                          "mt-2 line-clamp-1 block max-w-[52ch] text-sm leading-6 transition-colors duration-500",
                          light
                            ? "text-white/70 lg:text-muted-foreground lg:group-hover:text-white/75 lg:group-focus-visible:text-white/75"
                            : "text-white/70",
                        )}
                      >
                        {origin.summary}
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={cn(
                      "flex shrink-0 flex-wrap items-center gap-x-3 text-xs font-semibold tracking-wide uppercase transition-colors duration-500 sm:justify-end sm:text-end sm:text-sm sm:normal-case sm:tracking-normal",
                      light
                        ? "text-white/75 lg:text-muted-foreground lg:group-hover:text-white/80 lg:group-focus-visible:text-white/80"
                        : "text-white/75",
                    )}
                  >
                    <span>{origin.continentLabel}</span>
                    <span aria-hidden="true" className="opacity-50">
                      |
                    </span>
                    <span>{origin.coffeeCountLabel}</span>
                    {origin.media ? null : (
                      <Globe2
                        className="size-4 opacity-70"
                        aria-hidden="true"
                      />
                    )}
                  </span>

                  <ArrowUpRight
                    aria-hidden="true"
                    className={cn(
                      "hidden size-5 shrink-0 transition-transform duration-500 sm:block group-hover:translate-x-1 group-hover:-translate-y-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1",
                      light
                        ? "text-gold-bright lg:text-foreground lg:group-hover:text-gold-bright lg:group-focus-visible:text-gold-bright"
                        : "text-gold-bright",
                    )}
                  />
                </span>
              </Link>
            </SectionReveal>
          </li>
        );
      })}
    </ul>
  );
}
