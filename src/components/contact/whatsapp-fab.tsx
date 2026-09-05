"use client";

import { useCallback, useEffect, useRef } from "react";
import { WhatsAppIcon } from "@/components/brand/social-icons";

/**
 * The floating WhatsApp action, repositionable by the reader.
 *
 * Four constraints shape the implementation.
 *
 * **It must not break hydration.** The saved position lives in `localStorage`,
 * which the server cannot see, so the rendered markup is always the default
 * corner, expressed in CSS. A saved position is applied after mount by writing
 * to the element, which is a paint rather than a mismatch. Reading storage
 * during render would produce exactly the hydration error this project fails
 * builds over.
 *
 * **Position is DOM state, not React state.** The button's coordinates are
 * written straight onto the node. A drag is direct manipulation: routing every
 * pointer frame through `setState` would re-render the component dozens of
 * times a second to compute markup that never changes, and the position would
 * still have to be reconciled against a CSS default it is meant to replace.
 * Nothing else in the tree depends on where the button sits, so there is
 * nothing for React to know about.
 *
 * **A drag must never navigate.** Pointer capture keeps the gesture on this
 * element once it starts, and movement past a few pixels marks the following
 * `click` for suppression — without that, every drag would open a new tab,
 * because a drag on an anchor still produces a click.
 *
 * **Repositioning must not be mouse-only.** Pointer events cover mouse, touch
 * and pen through one code path, and the arrow keys move the button for anyone
 * who cannot drag. `touch-action: none` is what makes a touch drag work at all
 * — without it the browser claims the gesture for scrolling.
 *
 * The button is `position: fixed`, so it never participates in layout: it
 * cannot shift the page and cannot widen it.
 */

const STORAGE_KEY = "hills:whatsapp-position";
/** Keeps the control clear of every viewport edge, dragged or not. */
const EDGE = 16;
const NUDGE = 16;
/** Movement under this is a tap with an unsteady finger, not a drag. */
const DRAG_SLOP = 6;

type Point = { x: number; y: number };

const STEPS: Record<string, Point> = {
  ArrowLeft: { x: -NUDGE, y: 0 },
  ArrowRight: { x: NUDGE, y: 0 },
  ArrowUp: { x: 0, y: -NUDGE },
  ArrowDown: { x: 0, y: NUDGE },
};

export function WhatsAppFab({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const drag = useRef<{
    id: number;
    offsetX: number;
    offsetY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  /** True once the button has been moved off its CSS default corner. */
  const placed = useRef(false);

  /** No part of the control may end up outside the visible viewport. */
  const clamp = useCallback((point: Point, element: HTMLElement): Point => {
    const maxX = Math.max(EDGE, window.innerWidth - element.offsetWidth - EDGE);
    const maxY = Math.max(
      EDGE,
      window.innerHeight - element.offsetHeight - EDGE,
    );
    return {
      x: Math.min(Math.max(point.x, EDGE), maxX),
      y: Math.min(Math.max(point.y, EDGE), maxY),
    };
  }, []);

  /**
   * Writes the position onto the node, replacing the CSS corner. The logical
   * insets are cleared so a dragged position means the same thing in Arabic as
   * in English: the reader put the button *there*, not "that far from the
   * start edge".
   */
  const place = useCallback((element: HTMLElement, point: Point) => {
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    element.style.insetInlineEnd = "auto";
    element.style.insetBlockEnd = "auto";
    placed.current = true;
  }, []);

  const persist = useCallback((point: Point) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(point));
    } catch {
      // Private browsing or blocked storage: the position simply does not
      // survive the visit. Nothing else about the control changes.
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let stored: Point | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        const { x, y } = parsed as Partial<Point>;
        if (Number.isFinite(x) && Number.isFinite(y))
          stored = { x: Number(x), y: Number(y) };
      }
    } catch {
      // Unreadable or corrupt value: keep the default corner.
    }
    if (stored) place(element, clamp(stored, element));

    // A saved position can fall outside a smaller window — a rotated phone, a
    // resized desktop — so it is re-clamped rather than left off-screen.
    const onResize = () => {
      if (!placed.current) return;
      const rect = element.getBoundingClientRect();
      place(element, clamp({ x: rect.left, y: rect.top }, element));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, place]);

  const onPointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    drag.current = {
      id: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an optimisation; the gesture still works without it.
    }
    // Hand over from the CSS corner to explicit coordinates at the position it
    // is already painted at, so nothing jumps under the finger.
    place(element, { x: rect.left, y: rect.top });
    element.dataset.dragging = "true";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    if (
      !state.moved &&
      Math.hypot(event.clientX - state.originX, event.clientY - state.originY) >
        DRAG_SLOP
    )
      state.moved = true;
    const element = event.currentTarget;
    place(
      element,
      clamp(
        { x: event.clientX - state.offsetX, y: event.clientY - state.offsetY },
        element,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    const element = event.currentTarget;
    delete element.dataset.dragging;
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // Already released, or never captured.
    }
    if (!state.moved) return;
    suppressClick.current = true;
    const rect = element.getBoundingClientRect();
    persist({ x: rect.left, y: rect.top });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    const step = STEPS[event.key];
    if (!step) return;
    // Otherwise the arrow keys scroll the page instead of moving the button.
    event.preventDefault();
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const next = clamp(
      { x: rect.left + step.x, y: rect.top + step.y },
      element,
    );
    place(element, next);
    persist(next);
  };

  return (
    <>
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        aria-describedby="whatsapp-fab-hint"
        data-testid="whatsapp-fab"
        title={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
        }}
        onDragStart={(event) => event.preventDefault()}
        className="fixed end-5 bottom-5 z-40 grid size-14 cursor-grab touch-none place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_32px_rgb(0_0_0/0.28)] ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[dragging]:scale-105 data-[dragging]:cursor-grabbing"
      >
        <WhatsAppIcon className="pointer-events-none size-7" />
      </a>
      {/* Referenced by `aria-describedby`; a hidden element is still read for
          the accessible description, and this way it occupies no layout. */}
      <span id="whatsapp-fab-hint" hidden>
        {hint}
      </span>
    </>
  );
}
