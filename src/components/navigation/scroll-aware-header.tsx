"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Hides during a sustained downward read and returns as soon as the visitor
 * reverses direction. It animates only compositor-friendly properties.
 */
export function ScrollAwareHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { scrollY } = useScroll();
  const reduced = useReducedMotion() === true;
  const [visible, setVisible] = useState(true);
  const lastToggleY = useRef(0);

  useMotionValueEvent(scrollY, "change", (current) => {
    if (reduced) return;
    const previous = scrollY.getPrevious() ?? 0;
    const delta = current - previous;
    if (current < 84) {
      if (!visible) setVisible(true);
      return;
    }
    // Ignore tiny wheel/trackpad noise, otherwise the bar would flicker.
    if (Math.abs(delta) < 5 || Math.abs(current - lastToggleY.current) < 12)
      return;
    if (delta > 0 && visible) {
      lastToggleY.current = current;
      setVisible(false);
    }
    if (delta < 0 && !visible) {
      lastToggleY.current = current;
      setVisible(true);
    }
  });

  return (
    <motion.header
      className={cn(className)}
      initial={false}
      animate={
        reduced || visible
          ? { y: 0, opacity: 1 }
          : { y: "-112%", opacity: 0.98 }
      }
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 310, damping: 32, mass: 0.55 }
      }
    >
      {children}
    </motion.header>
  );
}
