"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hides during a sustained downward read and returns on reversal. It uses one
 * passive browser scroll listener, batched with rAF; the visual transition is
 * native CSS rather than a global animation runtime.
 */
export function ScrollAwareHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastY = window.scrollY;
    let lastToggleY = 0;
    let frame = 0;

    const setHeaderVisible = (next: boolean) => {
      if (visibleRef.current === next) return;
      visibleRef.current = next;
      setVisible(next);
    };
    const update = () => {
      frame = 0;
      if (reducedMotion.matches) {
        setHeaderVisible(true);
        return;
      }
      const current = window.scrollY;
      const delta = current - lastY;
      lastY = current;
      if (current < 84) {
        setHeaderVisible(true);
        return;
      }
      if (Math.abs(delta) < 5 || Math.abs(current - lastToggleY) < 12) return;
      if (delta > 0 && visibleRef.current) {
        lastToggleY = current;
        setHeaderVisible(false);
      } else if (delta < 0 && !visibleRef.current) {
        lastToggleY = current;
        setHeaderVisible(true);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const onPreferenceChange = () => {
      lastY = window.scrollY;
      if (reducedMotion.matches) setHeaderVisible(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    reducedMotion.addEventListener("change", onPreferenceChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className={cn(
        "transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        !visible && "pointer-events-none -translate-y-[112%] opacity-[0.98]",
        className,
      )}
    >
      {children}
    </header>
  );
}
