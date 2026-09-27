"use client";

import { useSyncExternalStore } from "react";

/**
 * How much scroll-linked motion the current device should get.
 *
 *   full — a large screen driven by a mouse or trackpad: the complete parallax
 *          and scroll-driven card choreography.
 *   lite — phones, tablets and touch screens: the same motion at a fraction of
 *          the travel, and no hover-only behaviour.
 *   none — `prefers-reduced-motion: reduce`: everything settles in place.
 *
 * Read through `useSyncExternalStore` so the server snapshot is always
 * `none` — the settled layout — and the client upgrades after hydration
 * without a mismatch. Media-query listeners fire only when a query flips,
 * never on scroll, so this costs nothing while the page moves.
 */
export type MotionTier = "full" | "lite" | "none";

const QUERIES = {
  reduced: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
} as const;

function subscribe(onChange: () => void) {
  const lists = Object.values(QUERIES).map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange);
  };
}

function getSnapshot(): MotionTier {
  if (window.matchMedia(QUERIES.reduced).matches) return "none";
  return window.matchMedia(QUERIES.desktop).matches ? "full" : "lite";
}

function getServerSnapshot(): MotionTier {
  return "none";
}

export function useMotionTier(): MotionTier {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
