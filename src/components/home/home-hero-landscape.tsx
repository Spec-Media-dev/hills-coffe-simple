"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Leaf,
  Package,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Link } from "@/i18n/navigation";

export type HeroStat = { label: string; value: string };

/*
 * Layer assignment, decided by looking at the pixels rather than the names.
 *
 *   base   — hero-coffee-midground.png. The only plate with a full, opaque sky,
 *            so it is the far plane the other two sit in front of. Cover-scaled
 *            to the whole scene behind a dark atmospheric wash; sinks the most
 *            on scroll and fades, like the reference's farthest mountains.
 *   depth  — hero-coffee-landscape-bg.png. Transparent above the ridgeline,
 *            opaque hills below: a cutout that must sit in front of a sky, not
 *            be one. Width-fitted, anchored to the bottom edge; sinks less.
 *   front  — hero-coffee-foreground.png. Coffee bushes, transparent top. Same
 *            canvas as `depth`, so the two register exactly at rest. Moves with
 *            the page, which is what makes the planes behind it read as
 *            receding.
 *
 * Stacking (scene is one stacking context; the copy column has z-index auto
 * on purpose so its children take part directly):
 *   0 base · 1 wash · 2 depth · 3 bean · 4 front · 5 copy · 6 bottom band
 * The bean sits in front of the far hills and behind the bushes so that, like
 * the reference's sun, it sinks behind the nearest plane as the scene scrolls.
 */
const PARTNER_MARKS = [Building2, Warehouse, Truck, Leaf, ShieldCheck, Package];

function useDesktopMotion() {
  const reduced = useReducedMotion() === true;
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return !reduced && desktop;
}

export function HomeHeroLandscape({
  eyebrow,
  title,
  intro,
  stats,
  beanCtaLabel,
  partnersLabel,
  partnersSrText,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  stats: HeroStat[];
  beanCtaLabel: string;
  partnersLabel: string;
  partnersSrText: string;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const animate = useDesktopMotion();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end start"],
  });
  // The reference scrubs with a ~1.2s lag; a light spring gives the same
  // settled, weighty feel without the layers falling behind a fast wheel.
  const progress = useSpring(scrollYProgress, {
    stiffness: 190,
    damping: 34,
    mass: 0.4,
  });
  const still = ["0%", "0%"];

  // Far → near: the base sinks most, the hills less, the bushes not at all.
  const baseY = useTransform(progress, [0, 1], animate ? ["0%", "44%"] : still);
  const baseOpacity = useTransform(
    progress,
    [0, 1],
    animate ? [1, 0.55] : [1, 1],
  );
  const depthY = useTransform(progress, [0, 1], animate ? ["0%", "24%"] : still);
  const beanY = useTransform(progress, [0, 1], animate ? ["0%", "150%"] : still);
  const copyY = useTransform(progress, [0, 1], animate ? ["0%", "-70%"] : still);
  const copyOpacity = useTransform(
    progress,
    [0, 0.6],
    animate ? [1, 0] : [1, 1],
  );

  return (
    <section className="home-hero relative isolate overflow-hidden bg-primary text-primary-foreground">
      <div
        ref={sceneRef}
        className="relative overflow-hidden lg:min-h-[clamp(54rem,135svh,78rem)]"
      >
        {/* 0 · base plate. Cover-scaled so it has no top edge of its own; the
            wash hides the room it needs to sink into. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ y: baseY, opacity: baseOpacity }}
        >
          <Image
            src="/images/new%20edit/hero-coffee-midground.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_72%]"
          />
        </motion.div>

        {/* 1 · fixed atmospheric wash: opaque forest across the copy zone,
            fading into the landscape. Never moves, so whatever the base
            uncovers as it sinks is already covered. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-primary from-[36%] via-primary/70 via-[56%] to-primary/0 to-[80%] lg:from-[46%] lg:via-[62%] lg:to-[84%]"
        />

        {/* Copy column — in flow, z-index auto (no stacking context), so the
            copy paints above every plane and the bean below the hills. */}
        <div className="site-container relative flex flex-col items-center pt-14 text-center sm:pt-16 lg:pt-20">
          <motion.div
            className="relative z-[5] flex flex-col items-center"
            style={{ y: copyY, opacity: copyOpacity }}
          >
            <p className="eyebrow !text-gold-contrast">{eyebrow}</p>
            <h1 className="display-hero mt-6 max-w-5xl text-balance">
              {title}
            </h1>
            <p className="mt-6 max-w-[58ch] text-base leading-8 text-white/82 md:text-lg lg:mt-7">
              {intro}
            </p>
          </motion.div>

          {/* 3 · the bean, directly under the copy. A real link, so hover and
              keyboard focus share one affordance. */}
          <motion.div className="relative z-[3] mt-8 lg:mt-6" style={{ y: beanY }}>
            <Link
              href="/green-coffee-offer-list"
              className="group relative block size-36 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-primary sm:size-44 lg:size-56"
            >
              <span className="sr-only">{beanCtaLabel}</span>
              {/* Resting glow is faint; hover/focus brings up the green halo.
                  Two rings so the falloff reads soft, not neon. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[28%] rounded-full bg-[#9fd66f]/15 blur-3xl transition-all duration-500 ease-out group-hover:scale-110 group-hover:bg-[#9fd66f]/45 group-focus-visible:scale-110 group-focus-visible:bg-[#9fd66f]/45"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[8%] rounded-full bg-[#b6e592]/0 blur-xl transition-colors duration-500 ease-out group-hover:bg-[#b6e592]/35 group-focus-visible:bg-[#b6e592]/35"
              />
              <span
                aria-hidden="true"
                className="relative block size-full transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:rotate-6 group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.04] group-focus-visible:rotate-6"
              >
                <Image
                  src="/images/new%20edit/hero-green-coffee-bean.png"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 14rem, (min-width: 640px) 11rem, 9rem"
                  className="object-contain drop-shadow-[0_22px_40px_rgba(6,24,18,0.6)]"
                />
              </span>
            </Link>
          </motion.div>

          {/* Gives the scene its landscape height below the bean on small
              screens; on lg the scene's own min-height governs. */}
          <div
            aria-hidden="true"
            className="h-[clamp(22rem,95vw,36rem)] lg:hidden"
          />
        </div>

        {/* 2 · depth plane — the hills cutout. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center"
          style={{ y: depthY }}
        >
          <Image
            src="/images/new%20edit/hero-coffee-landscape-bg.png"
            alt=""
            width={1672}
            height={941}
            priority
            sizes="100vw"
            className="h-auto w-full min-w-[44rem] max-w-none shrink-0"
          />
        </motion.div>

        {/* 4 · front plane — coffee bushes, moves with the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] flex justify-center"
        >
          <Image
            src="/images/new%20edit/hero-coffee-foreground.png"
            alt=""
            width={1672}
            height={941}
            priority
            sizes="100vw"
            className="h-auto w-full min-w-[44rem] max-w-none shrink-0"
          />
        </div>

        {/* 6 · bottom band over the bushes — the reference's "known from"
            row. Neutral placeholder marks until real logos arrive. */}
        <div className="absolute inset-x-0 bottom-0 z-[6] bg-gradient-to-t from-primary via-primary/85 to-primary/0 pt-16">
          <div className="site-container flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pb-6 lg:justify-start lg:gap-x-10">
            <span className="eyebrow shrink-0 !text-gold-contrast">
              {partnersLabel}
            </span>
            <span className="sr-only">{partnersSrText}</span>
            <ul
              aria-hidden="true"
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 opacity-75"
            >
              {PARTNER_MARKS.map((Icon, index) => (
                <li
                  key={index}
                  className={`h-9 w-20 items-center justify-center rounded-md border border-white/15 text-white/55 sm:w-24 ${index < 3 ? "flex" : "hidden sm:flex"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* The four checkable facts on their own solid ground under the scene,
          so the composition above stays as spare as the reference. */}
      {stats.length ? (
        <dl className="site-container relative grid grid-cols-2 border-t border-white/15 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border-white/15 py-5 pe-6 nth-[2n]:border-s nth-[2n]:pe-0 nth-[2n]:ps-6 nth-[n+3]:border-t md:py-6 md:pe-7 md:ps-7 md:nth-[-n+4]:border-t-0 md:nth-[n+2]:border-s md:first:ps-0"
            >
              <dt className="text-xs leading-5 text-white/70">{stat.label}</dt>
              <dd className="mt-1 text-sm leading-6 font-semibold">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
