"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export type HeroFrame = {
  src: string;
  /** Crop for this particular frame, including any `rtl:` variant. */
  className: string;
};

/**
 * A two-frame editorial crossfade for the home hero.
 *
 * Three constraints shape this, and they are why it is not a carousel:
 *
 *  1. **The first frame must stay the LCP element.** It renders exactly as it
 *     did before — server-rendered, `priority`, no wrapper that could delay
 *     paint. The second frame is not in the markup at all until the browser
 *     is idle, so it cannot compete for bandwidth with the largest paint.
 *  2. **No layout shift.** Both frames are `fill` inside the same box, so the
 *     box never changes size and CLS stays at zero.
 *  3. **No controls.** There are no dots, arrows or slide mechanics: the two
 *     photographs are two views of the same business, and the transition is
 *     meant to read as a slow dissolve rather than a widget.
 *
 * With `prefers-reduced-motion` the rotation never arms and the second frame
 * is never fetched — a person who asked for less motion gets one still image
 * and a smaller page, not a paused animation.
 */
export function HeroImageRotation({
  frames,
  sizes,
}: {
  frames: HeroFrame[];
  sizes: string;
}) {
  const reduced = useReducedMotion() === true;
  const [armed, setArmed] = useState(false);
  const [index, setIndex] = useState(0);

  // Bring the later frames in only once the main work is done.
  useEffect(() => {
    if (reduced || frames.length < 2) return;
    let idleHandle = 0;
    let timeoutHandle = 0;
    const arm = () => setArmed(true);
    if (typeof window.requestIdleCallback === "function")
      idleHandle = window.requestIdleCallback(arm, { timeout: 2500 });
    else timeoutHandle = window.setTimeout(arm, 1500);
    return () => {
      if (idleHandle && typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [reduced, frames.length]);

  useEffect(() => {
    if (!armed || reduced || frames.length < 2) return;
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % frames.length),
      3200,
    );
    return () => window.clearInterval(id);
  }, [armed, reduced, frames.length]);

  return (
    <>
      {frames.map((frame, position) => {
        // Later frames stay out of the DOM until armed, so they are neither
        // fetched nor decoded before the first meaningful paint.
        if (position > 0 && !armed) return null;
        return (
          <Image
            key={frame.src}
            src={frame.src}
            alt=""
            fill
            priority={position === 0}
            loading={position === 0 ? undefined : "lazy"}
            sizes={sizes}
            className={`${frame.className} transition-opacity duration-[1600ms] ease-in-out ${
              position === index ? "opacity-100" : "opacity-0"
            }`}
          />
        );
      })}
    </>
  );
}
