"use client";

import Image from "next/image";
import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Lock } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

export type StackedPanel = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  image: { src: string; alt: string };
  /** Shown above the eyebrow on a gated panel (e.g. "Authorized access"). */
  badge?: string;
  /** Fully-formed action markup — a plain Link for public panels, or an
   *  AuthCta (persona-aware) for the gated one. Composed by the caller so
   *  this component never needs to know about auth state. */
  action: ReactNode;
};

/*
 * Three large sheets that stack, after to-top.ch's service panels.
 *
 * Mechanics are deliberately the reference's own: the sheets are direct
 * siblings in one flex column with a fixed gap; every sheet is
 * `position: sticky` with the same top offset (header height plus a small
 * margin); later siblings carry a higher z-index. Sheet 1 pins under the
 * header, sheet 2 arrives from normal document flow and covers it, then
 * sheet 3 covers sheet 2. Scrolling back up uncovers them in reverse, because
 * nothing here is timed — the scroll position alone decides. The covered
 * sheet is still there underneath, scaled back a few percent and dimmed, so
 * the three read as a physical stack rather than a slideshow.
 *
 * Below `sm` there is no sticky and no overlap: the sheets stack in order
 * with a normal gap, which is the kinder experience on a phone.
 */
export function StackedFeaturePanels({ panels }: { panels: StackedPanel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  return (
    <div
      ref={containerRef}
      className="site-container flex flex-col gap-6 sm:gap-[6.5rem] lg:gap-[7.5rem]"
    >
      {panels.map((panel, index) => (
        <StackedPanelItem
          key={panel.key}
          panel={panel}
          index={index}
          isLast={index === panels.length - 1}
          containerRef={containerRef}
          scrollY={scrollY}
        />
      ))}
    </div>
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function StackedPanelItem({
  panel,
  index,
  isLast,
  containerRef,
  scrollY,
}: {
  panel: StackedPanel;
  index: number;
  isLast: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  scrollY: MotionValue<number>;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() === true;

  /*
   * How far the next sheet has risen over this one: 0 while it is still below
   * this sheet's bottom edge, 1 once it is fully pinned on top. Derived from
   * the column's geometry rather than from this element's own box, because a
   * pinned sticky element reports its pinned position — measuring it directly
   * would freeze the value the moment the transition starts.
   */
  const cover = useTransform(scrollY, (y) => {
    if (reduced || isLast) return 0;
    const column = containerRef.current;
    const sheet = ref.current;
    if (!column || !sheet) return 0;
    const style = getComputedStyle(sheet);
    if (style.position !== "sticky") return 0;
    const height = sheet.offsetHeight;
    const gap = parseFloat(getComputedStyle(column).rowGap) || 0;
    const pinTop = parseFloat(style.top) || 0;
    const columnTop = column.getBoundingClientRect().top + window.scrollY;
    const nextTop = columnTop + (index + 1) * (height + gap);
    const start = nextTop - pinTop - height;
    const end = nextTop - pinTop;
    return clamp01((y - start) / (end - start));
  });
  const scale = useTransform(cover, [0, 1], [1, 0.94]);
  const dim = useTransform(cover, [0, 1], [0, 0.55]);

  return (
    <motion.article
      ref={ref}
      style={{ scale, zIndex: index + 1 }}
      className="relative isolate flex min-h-[30rem] overflow-hidden rounded-[2rem] bg-primary text-primary-foreground shadow-[0_32px_90px_rgb(10_20_16/.35)] sm:sticky sm:top-[6.5rem] sm:h-[min(72svh,42rem)] sm:min-h-[32rem] lg:rounded-[2.5rem]"
    >
      {/* The photograph is the sheet. */}
      <Image
        src={panel.image.src}
        alt={panel.image.alt}
        fill
        sizes="(min-width: 1280px) 80rem, 100vw"
        className="object-cover"
      />
      {/* Legibility: a start-side wash where the copy sits and a foot wash
          under the action. Logical direction, so Arabic reads from the
          other edge without a mirrored photograph. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-primary/92 via-primary/55 via-[45%] to-primary/10 rtl:bg-gradient-to-l"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-primary/25"
      />
      {/* Dims as the next sheet covers it. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#0b1f19]"
        style={{ opacity: dim }}
      />

      {/* Big index, top-end like the reference's faded numerals. */}
      <span
        aria-hidden="true"
        className="absolute top-6 end-7 font-heading text-[clamp(4rem,9vw,8.5rem)] leading-none font-extrabold text-white/12 select-none sm:top-4 sm:end-10"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative flex w-full flex-col justify-end p-7 sm:p-10 lg:max-w-[46rem] lg:p-14">
        {panel.badge ? (
          <p className="flex items-center gap-2.5">
            <Lock className="size-3.5 text-gold-contrast" aria-hidden="true" />
            <span className="eyebrow !text-gold-contrast">{panel.badge}</span>
          </p>
        ) : (
          <p className="eyebrow !text-gold-contrast">{panel.eyebrow}</p>
        )}
        <h3 className="mt-4 font-heading text-4xl leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          {panel.title}
        </h3>
        <p className="mt-5 max-w-[46ch] text-base leading-7 text-white/80 md:text-lg md:leading-8">
          {panel.description}
        </p>
        <div className="mt-8">{panel.action}</div>
      </div>
    </motion.article>
  );
}
