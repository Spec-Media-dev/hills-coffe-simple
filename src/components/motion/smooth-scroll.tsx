"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Wheel smoothing for the public site.
 *
 * A mouse wheel moves the page in ~100px steps, so every scroll-linked layer —
 * the hero planes, the highlight cards, the CSS view-timeline reveals — also
 * advanced in steps. Lenis interpolates the wheel input and writes the result
 * back to the native scroll position, so `position: sticky`, IntersectionObserver,
 * Motion's `useScroll` and `animation-timeline: view()` all keep reading the
 * real document scroll. Nothing is hijacked: no virtual container, no pinned
 * wrapper, and the scrollbar, keyboard, find-in-page and anchors stay native.
 *
 * Deliberately narrow:
 * - Only for a fine pointer on a hover-capable device. Touch keeps the
 *   platform's own momentum, which no script improves on.
 * - Never under `prefers-reduced-motion`.
 * - Dialogs, drawers and any element that can scroll itself keep native wheel
 *   handling, and while a component has locked the body (the mobile drawer
 *   does) the wheel is left entirely to the browser.
 */
export function SmoothScroll() {
  useEffect(() => {
    const capable = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let lenis: Lenis | null = null;

    const start = () => {
      if (lenis || !capable.matches) return;
      lenis = new Lenis({
        autoRaf: true,
        /*
         * Tuned against the TO TOP reference, which uses a 2.3s duration: one
         * wheel notch there takes ~1.5s to come to rest, which reads as lag.
         * A 0.1 lerp settles in roughly 0.4–0.5s — clearly smoothed, with no
         * "the page is still moving after I stopped" tail — and the wheel
         * distance stays 1:1 with the native step.
         */
        lerp: 0.1,
        wheelMultiplier: 1,
        allowNestedScroll: true,
        // A route change scrolls the new page to the top natively; any glide
        // still in flight from the previous page must not carry on after it.
        stopInertiaOnNavigate: true,
        prevent: (node) =>
          node.getAttribute("role") === "dialog" ||
          node.getAttribute("aria-modal") === "true" ||
          node.getAttribute("role") === "menu" ||
          node.getAttribute("role") === "listbox",
        virtualScroll: () => document.body.style.overflow !== "hidden",
      });
    };
    const stop = () => {
      lenis?.destroy();
      lenis = null;
    };
    const onChange = () => (capable.matches ? start() : stop());

    start();
    capable.addEventListener("change", onChange);
    return () => {
      capable.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return null;
}
