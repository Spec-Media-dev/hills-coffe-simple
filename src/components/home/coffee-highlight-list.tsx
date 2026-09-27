"use client";

import Image from "next/image";
import { ArrowUpRight, PackageOpen } from "lucide-react";
import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Link } from "@/i18n/navigation";
import { useMotionTier } from "@/hooks/use-motion-tier";
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

/** Largest width reduction of a card far from the reading line (6%). */
const MAX_DROP = 0.06;
/** Extra shade laid over a card that is not the one being read. */
const MAX_DIM = 0.42;

/**
 * Which card dominates is a pure function of where each card sits in the
 * viewport — never of scroll direction — so scrolling down and back up pass
 * through exactly the same states.
 *
 * `progress` is 0 when the card's centre is at the bottom of the viewport and
 * 1 when it reaches the top; 0.5 is the reading line. The first card keeps
 * full width everywhere below that line (it is what you arrive at from
 * above) and the last card keeps it everywhere above (what you leave on).
 * Returns 0 for the dominant card and 1 for a card at the viewport edge.
 */
function distanceFromReadingLine(
  progress: number,
  first: boolean,
  last: boolean,
) {
  let offset = progress - 0.5;
  if (first && offset < 0) offset = 0;
  if (last && offset > 0) offset = 0;
  const a = Math.min(1, Math.abs(offset) / 0.5);
  return a * a * (3 - 2 * a); // smoothstep: gentle at the centre
}

/**
 * The catalogue's editorial highlights as a scroll-aware stack.
 *
 * On a desktop with a mouse, the card nearest the reading line is the widest
 * and fully lit, its neighbours sit a few percent narrower and slightly
 * shaded, and the hand-off between them follows the scroll continuously.
 * This works for any number of cards. Width is expressed as a uniform
 * `scale` on the card — a composited transform, so scrolling never triggers
 * layout — and the shade is an opacity. Motion writes both straight to the
 * DOM; React does not re-render while the page scrolls.
 *
 * Hovering a card while the next one is still mostly below the fold lifts
 * the next card a little into view as a preview. That is hover-only and
 * therefore desktop-only; it never moves the page's scroll position.
 *
 * Phones and tablets get a calm, full-width list.
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
  const tier = useMotionTier();
  const full = tier === "full" && coffees.length > 1;
  // Index of the hovered card whose successor is being previewed.
  const [previewFrom, setPreviewFrom] = useState<number | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  const startPreview = (index: number) => {
    if (!full) return;
    const next = itemRefs.current[index + 1];
    // Only when the next card is actually waiting below the fold; a card
    // already on screen needs no preview.
    const waiting =
      next !== undefined &&
      next !== null &&
      next.getBoundingClientRect().top > window.innerHeight * 0.62;
    setPreviewFrom(waiting ? index : null);
  };

  return (
    <ul
      className="mt-10 flex flex-col gap-3 lg:mt-14 lg:gap-5"
      onMouseLeave={() => setPreviewFrom(null)}
    >
      {coffees.map((coffee, index) => (
        <HighlightCard
          key={coffee.id}
          coffee={coffee}
          index={index}
          count={coffees.length}
          full={full}
          lift={
            previewFrom === index
              ? "hovered"
              : previewFrom !== null && previewFrom + 1 === index
                ? "preview"
                : "rest"
          }
          itemRef={(node) => {
            itemRefs.current[index] = node;
          }}
          onPointerEnter={() => startPreview(index)}
          bagsLabel={bagsLabel}
          viewLabel={viewLabel}
        />
      ))}
    </ul>
  );
}

function HighlightCard({
  coffee,
  index,
  count,
  full,
  lift,
  itemRef,
  onPointerEnter,
  bagsLabel,
  viewLabel,
}: {
  coffee: CoffeeHighlight;
  index: number;
  count: number;
  full: boolean;
  lift: "rest" | "hovered" | "preview";
  itemRef: (node: HTMLLIElement | null) => void;
  onPointerEnter: () => void;
  bagsLabel: string;
  viewLabel: string;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["center end", "center start"],
  });
  const first = index === 0;
  const last = index === count - 1;
  const scale = useTransform(scrollYProgress, (p) =>
    full ? 1 - MAX_DROP * distanceFromReadingLine(p, first, last) : 1,
  );
  const dim = useTransform(scrollYProgress, (p) =>
    full ? MAX_DIM * distanceFromReadingLine(p, first, last) : 0,
  );

  return (
    <motion.li
      ref={(node) => {
        ref.current = node;
        itemRef(node);
      }}
      style={{ scale }}
      animate={{
        y: lift === "hovered" ? -6 : lift === "preview" ? -18 : 0,
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="origin-center"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onPointerEnter();
      }}
    >
      <Link
        href={`/green-coffee-offer-list/${coffee.slug}`}
        style={{ ["--reveal-index" as string]: index }}
        className={cn(
          "home-reveal-item group relative isolate flex min-h-[13.5rem] overflow-hidden rounded-[1.4rem] text-primary-foreground outline-none ring-1 ring-black/5 transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:min-h-[14.5rem] lg:min-h-[clamp(14rem,30svh,17.5rem)] lg:rounded-[1.6rem]",
          lift === "preview"
            ? "shadow-[0_28px_70px_rgb(13_42_33/.34)]"
            : "shadow-[0_18px_48px_rgb(13_42_33/.16)]",
        )}
      >
        <span aria-hidden="true" className="absolute inset-0 -z-10">
          {/* The branded ground is always painted first, so a record with no
              image — or an image that fails to load — still gets a designed
              card rather than a flat green block or a gap. */}
          <span
            className="highlight-fallback absolute inset-0"
            data-tone={index % 4}
          />
          {coffee.media ? (
            <Image
              src={coffee.media.url}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, min(80rem, 94vw)"
              className="object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none lg:group-hover:scale-[1.04]"
            />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-r from-[#0d2a22]/94 via-[#0f2e26]/70 via-[52%] to-[#102e26]/22 rtl:bg-gradient-to-l" />
          <DimLayer dim={dim} />
        </span>

        <span className="relative flex w-full flex-col justify-between gap-6 p-6 sm:p-8 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:px-10 lg:py-8">
          <span className="font-mono text-sm font-bold text-gold-contrast tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>

          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="eyebrow !text-gold-contrast">
                {coffee.origin}
              </span>
              <span className="text-xs font-semibold text-white/85">
                {[coffee.process, coffee.cupScore]
                  .filter((value) => value !== null && value !== "")
                  .join(" · ")}
              </span>
            </span>
            <span
              lang={coffee.nameLang}
              className="display-title mt-3 block max-w-[22ch] text-[2rem] sm:text-4xl lg:text-[3.15rem]"
            >
              {coffee.name}
            </span>
          </span>

          <span className="flex shrink-0 flex-col gap-4 text-sm text-white/90 lg:items-end lg:text-end">
            <span className="flex items-center gap-2">
              <PackageOpen
                className="size-4 shrink-0 text-gold-contrast"
                aria-hidden="true"
              />
              {coffee.bags} {bagsLabel} · {coffee.warehouse}
            </span>
            <span className="inline-flex items-center gap-2 font-bold text-gold-contrast">
              {viewLabel}
              <ArrowUpRight
                className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </span>
        </span>
      </Link>
    </motion.li>
  );
}

function DimLayer({ dim }: { dim: MotionValue<number> }) {
  return (
    <motion.span
      className="absolute inset-0 bg-[#081d17]"
      style={{ opacity: dim }}
    />
  );
}
