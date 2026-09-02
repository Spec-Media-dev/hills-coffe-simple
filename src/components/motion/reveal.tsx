"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
}) {
  const reduced = useReducedMotion();
  const shouldReduce = reduced === true;
  const Component = motion[as];
  return (
    <Component
      className={cn(className)}
      initial={shouldReduce ? false : { y: 24 }}
      whileInView={shouldReduce ? undefined : { y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}

export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion() === true;
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView={reduced ? undefined : "show"}
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduced ? 0 : 0.09 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion() === true;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { y: 0 } : { y: 18 },
        show: {
          y: 0,
          transition: {
            duration: reduced ? 0 : 0.6,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
