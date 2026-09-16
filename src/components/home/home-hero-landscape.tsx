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
 *   0 base · 1 wash / bean · 2 depth · 4 front · 5 copy · 6 partner band
 * The bean starts behind the ridgeline and rises above it only through its
 * position, so the mountain still reads as the foreground occluder.
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
  beanCtaLabel,
  partnersLabel,
  partnersSrText,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  beanCtaLabel: string;
  partnersLabel: string;
  partnersSrText: string;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const animate = useDesktopMotion();
  const reducedMotion = useReducedMotion() === true;
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
  const depthY = useTransform(
    progress,
    [0, 1],
    animate ? ["0%", "24%"] : still,
  );
  // The bean begins partially behind the ridgeline and rises as the visitor
  // scrolls. Its previous direction was inverted, so it sank into the scene.
  const beanY = useTransform(
    progress,
    [0, 1],
    animate ? ["27%", "-62%"] : ["12%", "12%"],
  );
  const copyY = useTransform(
    progress,
    [0, 1],
    animate ? ["0%", "-70%"] : still,
  );
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
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute inset-0 z-[1]"
        />
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
            <motion.p
              className="eyebrow hero-eyebrow !text-gold-contrast"
              initial={reducedMotion ? false : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              className="display-hero mt-6 max-w-6xl text-balance"
              initial={reducedMotion ? false : { opacity: 0, x: 72 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.14,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {title}
            </motion.h1>
            <motion.p
              className="mt-7 max-w-[62ch] text-lg leading-8 text-white/82 md:text-xl lg:mt-8"
              initial={reducedMotion ? false : { opacity: 0, x: 44 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {intro}
            </motion.p>
          </motion.div>

          {/* 3 · The bean has its own scene layer rather than living in the
              copy's flex flow. Its resting position therefore never changes
              when the headline wraps, while the mountain still occludes it. */}
          <div className="pointer-events-none absolute inset-x-0 top-[clamp(28rem,52vh,38rem)] z-[1] flex justify-center lg:top-[clamp(27rem,49vh,40rem)]">
            <motion.div className="pointer-events-auto" style={{ y: beanY }}>
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
                  className="hero-bean-float relative block size-full"
                >
                  <span className="relative block size-full transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:rotate-6 group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.04] group-focus-visible:rotate-6">
                    <Image
                      src="/images/new%20edit/hero-green-coffee-bean.png"
                      alt=""
                      fill
                      priority
                      sizes="(min-width: 1024px) 14rem, (min-width: 640px) 11rem, 9rem"
                      className="object-contain drop-shadow-[0_22px_40px_rgba(6,24,18,0.6)]"
                    />
                  </span>
                </span>
              </Link>
            </motion.div>
          </div>

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
        <div className="absolute inset-x-0 bottom-0 z-[6] bg-gradient-to-t from-primary via-primary/92 to-primary/0 pt-20">
          <div className="site-container flex flex-col gap-5 border-t border-white/15 py-6 sm:flex-row sm:items-center sm:gap-6 lg:py-7">
            <span className="eyebrow shrink-0 !text-gold-contrast">
              {partnersLabel}
            </span>
            <span
              aria-hidden="true"
              className="hidden h-12 w-px shrink-0 bg-white/20 sm:block"
            />
            <span className="sr-only">{partnersSrText}</span>
            <ul
              aria-hidden="true"
              className="grid w-full flex-1 grid-cols-3 items-center gap-3 text-white/65 sm:flex sm:justify-between sm:gap-6"
            >
              {PARTNER_MARKS.map((Icon, index) => (
                <li
                  key={index}
                  className="flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1 hover:rotate-3 sm:size-16 sm:min-h-0"
                >
                  <Icon
                    className="size-6 sm:size-7"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="hero-grain pointer-events-none absolute inset-0 z-[7]"
        />
      </div>
    </section>
  );
}
