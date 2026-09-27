"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useMotionTier } from "@/hooks/use-motion-tier";

/*
 * The home hero as a scroll scene.
 *
 * Mechanics studied on the TO TOP reference (rendered and wheel-scrolled, not
 * read from screenshots): the hero is not pinned; its length comes from a
 * landscape block taller than the viewport; separate image planes are moved by
 * scroll at different rates — the nearest plane moves with the page, farther
 * planes lag progressively more — and a sun-like object lags even more, so it
 * drifts up the viewport while the ground rises over it. A second timeline
 * fades the far planes into haze and fades the dark ending and the lower
 * content in. Here that becomes:
 *
 *   base  — hero-coffee-midground.png, the far plane (sky, mountains). Lags
 *           the most and hazes out.
 *   depth — hero-coffee-landscape-bg.png, the ridge and valley. Lags less.
 *   bean  — the coffee bean, between depth and the bushes. Lags like a distant
 *           object and grows slightly, so it travels up the viewport and gains
 *           presence while the coffee bushes rise in front of it.
 *   front — hero-coffee-foreground.png, the bushes. Moves with the page.
 *
 * Every value is a pure function of scroll position (reversing exactly when
 * scrolling up), spring-smoothed so the planes glide into place rather than
 * snapping to each wheel step, and written by Motion straight to transforms
 * and opacity — no layout work and no React renders while scrolling.
 *
 * Stacking inside the landscape block:
 *   0 base · 1 wash · 2 depth · 3 bean · 4 front · 5 ending shade · 6 band
 * The headline sits above the whole landscape (z 6 in the scene).
 */

/** How much of the full choreography each device tier gets. */
const INTENSITY = { full: 1, lite: 0.3, none: 0 } as const;

/** Soft "scrub": the planes settle ~half a second behind the scroll. */
const SCRUB = { stiffness: 120, damping: 26, mass: 0.6 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** easeOutCubic — the band and shade settle rather than stop. */
const ease = (value: number) => 1 - (1 - value) ** 3;

export function HomeHeroLandscape({
  eyebrow,
  title,
  intro,
  beanCtaLabel,
  audienceLabel,
  audience,
  offerLabel,
  offer,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  beanCtaLabel: string;
  audienceLabel: string;
  audience: string;
  offerLabel: string;
  offer: string;
}) {
  const landRef = useRef<HTMLDivElement>(null);
  const tier = useMotionTier();
  const k = INTENSITY[tier];
  const full = tier === "full";

  // Transform timeline: from the landscape's centre reaching the bottom of the
  // viewport to its bottom leaving the top — the whole time it is travelling.
  const { scrollYProgress: travelRaw } = useScroll({
    target: landRef,
    offset: ["center end", "end start"],
  });
  // Fade timeline: from the landscape's top entering the viewport until a
  // third of it has passed the top — the ending is fully formed by then.
  const { scrollYProgress: fadeRaw } = useScroll({
    target: landRef,
    offset: ["start end", "0.35 start"],
  });
  const travel = useSpring(travelRaw, SCRUB);
  const fade = useSpring(fadeRaw, SCRUB);

  // Planes: percentages of their own height, so every viewport keeps the
  // same proportions. `k` is read on every frame, so the intensity can change
  // after hydration (the server snapshot is "none") without new motion values.
  const baseY = useTransform(travel, (p) => `${p * 58 * k}%`);
  const depthY = useTransform(travel, (p) => `${p * 30 * k}%`);
  const baseOpacity = useTransform(fade, (p) => (full ? 1 - 0.5 * p : 1));

  // The bean: lags more than any plane (like the reference's sun, ~1.4× its
  // own size over the travel), grows a little, and turns a few degrees. It
  // fades out only once the bushes and the shade have covered it anyway.
  const beanY = useTransform(travel, (p) =>
    full ? `${-p * 130}%` : `${p * 140 * k}%`,
  );
  const beanScale = useTransform(travel, (p) => (full ? 1 + 0.16 * p : 1));
  const beanRotate = useTransform(travel, (p) => (full ? -8 + 20 * p : 0));
  const beanOpacity = useTransform(travel, (p) =>
    full ? 1 - clamp01((p - 0.72) / 0.22) : 1,
  );

  // Ending: the shade deepens and the band rises into place as the lower
  // landscape arrives.
  const shadeOpacity = useTransform(fade, (p) =>
    full ? 0.25 + 0.75 * ease(p) : 1,
  );
  const bandOpacity = useTransform(fade, (p) =>
    full ? 0.15 + 0.85 * ease(clamp01((p - 0.35) / 0.65)) : 1,
  );
  const bandY = useTransform(travel, (p) => (full ? -70 * p : 0));

  return (
    <section className="home-hero relative isolate bg-primary text-primary-foreground">
      <div className="hero-scene relative overflow-hidden">
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute inset-0 z-[1]"
        />

        {/* Headline block — in flow, above every plane, moving with the page
            like the reference's heading. */}
        <div className="hero-copy site-container relative z-[6] flex flex-col items-center text-center">
          <p className="hero-entry hero-entry-1 eyebrow hero-eyebrow !text-gold-contrast">
            {eyebrow}
          </p>
          <h1 className="hero-entry hero-entry-2 display-hero hero-title mt-5 text-balance sm:mt-6">
            {title}
          </h1>
          <p className="hero-entry hero-entry-3 hero-intro mt-6 text-white/88 lg:mt-8">
            {intro}
          </p>
        </div>

        {/* Landscape block — tucked up under the headline and clipped, so a
            plane that sinks never shows its edge outside the scene. */}
        <div ref={landRef} className="hero-land relative z-0 overflow-hidden">
          <div className="hero-land-layers absolute inset-0">
            <motion.div
              aria-hidden="true"
              className="hero-plate hero-plate-base pointer-events-none z-0"
              style={{ y: baseY, opacity: baseOpacity }}
            >
              <Image
                src="/images/new%20edit/hero-coffee-midground.png"
                alt=""
                width={1672}
                height={941}
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 117vw, max(44rem, 95vh)"
                className="hero-plate-img"
              />
            </motion.div>

            <div
              aria-hidden="true"
              className="hero-wash pointer-events-none absolute inset-x-0 top-0 z-[1]"
            />

            <motion.div
              aria-hidden="true"
              className="hero-plate pointer-events-none z-[2] lg:z-[3]"
              style={{ y: depthY }}
            >
              <Image
                src="/images/new%20edit/hero-coffee-landscape-bg.png"
                alt=""
                width={1672}
                height={941}
                loading="eager"
                fetchPriority="low"
                sizes="(min-width: 1024px) 117vw, max(44rem, 95vh)"
                className="hero-plate-img"
              />
            </motion.div>

            {/* The bean is the scene's one interactive object: a link to the
                offer list, between the ridge and the bushes. */}
            <div className="hero-bean-slot pointer-events-none absolute inset-x-0 z-[3] lg:z-[2] flex justify-center">
              <motion.div
                className="pointer-events-auto"
                style={{
                  y: beanY,
                  scale: beanScale,
                  rotate: beanRotate,
                  opacity: beanOpacity,
                }}
              >
                <Link
                  href="/green-coffee-offer-list"
                  className="group relative block size-28 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-4 focus-visible:ring-offset-primary sm:size-40 lg:size-48"
                >
                  <span className="sr-only">{beanCtaLabel}</span>
                  {/* Resting glow is faint; hover/focus brings up the green
                      halo. Two rings so the falloff reads soft, not neon. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[28%] rounded-full bg-[#9fd66f]/15 blur-3xl transition-all duration-500 ease-out group-hover:scale-110 group-hover:bg-[#9fd66f]/45 group-focus-visible:scale-110 group-focus-visible:bg-[#9fd66f]/45"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[8%] rounded-full bg-[#b6e592]/0 blur-xl transition-colors duration-500 ease-out group-hover:bg-[#b6e592]/35 group-focus-visible:bg-[#b6e592]/35"
                  />
                  <span className="relative block size-full transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.04] group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.04]">
                    <Image
                      src="/images/new%20edit/hero-green-coffee-bean.png"
                      alt=""
                      fill
                      loading="eager"
                      fetchPriority="low"
                      sizes="(min-width: 1024px) 12rem, (min-width: 640px) 10rem, 7rem"
                      className="object-contain drop-shadow-[0_22px_40px_rgba(6,24,18,0.6)]"
                    />
                  </span>
                </Link>
              </motion.div>
            </div>

            <div
              aria-hidden="true"
              className="hero-plate hero-plate-front pointer-events-none z-[4]"
            >
              <Image
                src="/images/new%20edit/hero-coffee-foreground.png"
                alt=""
                width={1672}
                height={941}
                loading="eager"
                fetchPriority="low"
                sizes="(min-width: 1024px) 117vw, max(44rem, 95vh)"
                className="hero-plate-img"
              />
            </div>
          </div>

          {/* The designed ending: the landscape darkens into deep forest… */}
          <motion.div
            aria-hidden="true"
            className="hero-ending-shade pointer-events-none absolute inset-x-0 bottom-0 z-[5]"
            style={{ opacity: shadeOpacity }}
          />

          {/* …and who Hills serves / what Hills does rises into it. */}
          <motion.div
            className="hero-ending absolute inset-x-0 bottom-[clamp(2rem,6vw,5rem)] z-[6]"
            style={{ opacity: bandOpacity, y: bandY }}
          >
            <dl className="site-container grid border-t border-white/18 sm:grid-cols-2">
              <div className="py-5 sm:py-7 sm:pe-10">
                <dt className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="font-mono text-[0.7rem] font-bold text-gold-bright/80"
                  >
                    01
                  </span>
                  <span className="eyebrow !text-gold-contrast">
                    {audienceLabel}
                  </span>
                </dt>
                <dd className="hero-ending-text mt-3">{audience}</dd>
              </div>
              <div className="border-t border-white/12 py-5 sm:border-t-0 sm:border-s sm:py-7 sm:ps-10">
                <dt className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="font-mono text-[0.7rem] font-bold text-gold-bright/80"
                  >
                    02
                  </span>
                  <span className="eyebrow !text-gold-contrast">
                    {offerLabel}
                  </span>
                </dt>
                <dd className="hero-ending-text mt-3">{offer}</dd>
              </div>
            </dl>
          </motion.div>
        </div>

        <div
          aria-hidden="true"
          className="hero-grain pointer-events-none absolute inset-0 z-[7]"
        />

        {/* A soft ridgeline into the cream page — hills, not a torn edge —
            overlapping the landscape's deep-green tail. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="hero-edge pointer-events-none relative z-[8] block w-full"
        >
          <path d="M0 80V50c96-12 188-24 300-20 118 4 196 30 318 30 132 0 214-34 346-38 130-4 222 22 334 20 60-1 106-8 142-14v52Z" />
        </svg>
      </div>
    </section>
  );
}
