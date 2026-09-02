"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function useMotionMode() {
  return useReducedMotion() === true;
}

type WrapperProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function PageReveal({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="page"
      className={cn(className)}
      initial={reduced ? false : { y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: reduced ? 0 : 0.42, ease }}
    >
      {children}
    </motion.div>
  );
}

export function SectionReveal({
  children,
  className,
  delay = 0,
}: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="section"
      className={cn(className)}
      initial={reduced ? false : { y: 28 }}
      whileInView={reduced ? undefined : { y: 0 }}
      viewport={{ once: true, amount: 0.14 }}
      transition={{
        duration: reduced ? 0 : 0.68,
        delay: reduced ? 0 : delay,
        ease,
      }}
    >
      {children}
    </motion.div>
  );
}

export function ImageReveal({ children, className, delay = 0 }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="image"
      className={cn("overflow-hidden", className)}
      initial={reduced ? false : { clipPath: "inset(0 0 100% 0)" }}
      whileInView={reduced ? undefined : { clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: reduced ? 0 : 0.82,
        delay: reduced ? 0 : delay,
        ease,
      }}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="hover-lift"
      className={cn(className)}
      whileHover={reduced ? undefined : { y: -5 }}
      transition={{ duration: reduced ? 0 : 0.22, ease }}
    >
      {children}
    </motion.div>
  );
}

export function NavUnderline({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.span
      data-motion="nav-underline"
      className={cn("relative inline-flex", className)}
      initial="rest"
      whileHover="active"
      whileFocus="active"
    >
      {children}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-2 h-px origin-start bg-current"
        variants={{ rest: { scaleX: reduced ? 1 : 0 }, active: { scaleX: 1 } }}
        transition={{ duration: reduced ? 0 : 0.24, ease }}
      />
    </motion.span>
  );
}

export function MegaMenuReveal({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="mega-menu"
      className={cn(className)}
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.99 }}
      transition={{ duration: reduced ? 0 : 0.2, ease }}
    >
      {children}
    </motion.div>
  );
}

type DrawerProps = WrapperProps & {
  id?: string;
  role?: string;
  "aria-modal"?: boolean | "true" | "false";
  "aria-label"?: string;
};

export const DrawerReveal = forwardRef<HTMLElement, DrawerProps>(
  function DrawerReveal({ children, className, ...props }, ref) {
    const reduced = useMotionMode();
    return (
      <motion.section
        ref={ref}
        {...props}
        data-motion="drawer"
        className={cn(className)}
        initial={
          reduced ? false : { opacity: 0, x: "var(--drawer-enter-x, -28px)" }
        }
        animate={{ opacity: 1, x: 0 }}
        exit={
          reduced
            ? { opacity: 1 }
            : { opacity: 0, x: "var(--drawer-enter-x, -20px)" }
        }
        transition={{ duration: reduced ? 0 : 0.28, ease }}
      >
        {children}
      </motion.section>
    );
  },
);

export function AccordionExpand({
  open,
  children,
  className,
}: WrapperProps & { open: boolean }) {
  const reduced = useMotionMode();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          data-motion="accordion"
          className={cn("overflow-hidden", className)}
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.26, ease }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function FilterTransition({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="filter"
      className={cn(className)}
      initial={reduced ? false : { y: 4 }}
      animate={{ y: 0 }}
      transition={{ duration: reduced ? 0 : 0.24, ease }}
    >
      {children}
    </motion.div>
  );
}

export function Toast({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="toast"
      role="status"
      className={cn(className)}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
      transition={{ duration: reduced ? 0 : 0.2, ease }}
    >
      {children}
    </motion.div>
  );
}

type ModalProps = WrapperProps & {
  role?: string;
  "aria-modal"?: boolean | "true" | "false";
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { children, className, ...props },
  ref,
) {
  const reduced = useMotionMode();
  return (
    <motion.div
      ref={ref}
      {...props}
      data-motion="modal"
      className={cn(className)}
      initial={reduced ? false : { opacity: 0, scale: 0.975 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
      transition={{ duration: reduced ? 0 : 0.22, ease }}
    >
      {children}
    </motion.div>
  );
});

export function Status({ children, className }: WrapperProps) {
  const reduced = useMotionMode();
  return (
    <motion.div
      data-motion="status"
      role="status"
      aria-live="polite"
      className={cn(className)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.18, ease }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence };
