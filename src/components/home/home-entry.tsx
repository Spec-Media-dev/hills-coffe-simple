"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/mark";

const SESSION_KEY = "hills:home-entered:v1";
let entered = false;

/** Asset readiness, not an artificial time-based counter. */
export function HomeEntry({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"loading" | "leaving" | "ready">(() =>
    entered ? "ready" : "loading",
  );
  const [progress, setProgress] = useState(0);
  const t = useTranslations("homeEntry");
  const brand = useTranslations("brand");
  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const previousOverflow = document.body.style.overflow;
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === "Tab") event.preventDefault();
    };
    const finish = () => {
      if (cancelled) return;
      entered = true;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* In-memory fallback. */
      }
      setPhase("ready");
      window.dispatchEvent(new Event("hills:home-ready"));
      document.removeEventListener("keydown", keepFocus, true);
      if (previousOverflow !== undefined)
        document.body.style.overflow = previousOverflow;
    };
    let repeat = entered;
    try {
      repeat ||= sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* Storage can be disabled. */
    }
    if (repeat) {
      finish();
      return;
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keepFocus, true);
    loader.current?.focus({ preventScroll: true });
    const images = Array.from(
      root.current?.querySelectorAll<HTMLImageElement>(".home-hero img") ?? [],
    );
    const logoImages = Array.from(
      loader.current?.querySelectorAll<HTMLImageElement>("img") ?? [],
    );
    const checks = [...images, ...logoImages].map((image) =>
      image.decode().catch(() => undefined),
    );
    checks.push(document.fonts.ready.then(() => undefined));
    const total = checks.length;
    let completed = 0;
    const settled = checks.map((check) =>
      check.finally(() => {
        completed += 1;
        if (!cancelled) setProgress(Math.round((completed / total) * 100));
      }),
    );
    // Failed/very slow assets must never trap someone behind the splash.
    const timeout = new Promise<void>((resolve) => {
      deadline = setTimeout(resolve, 8000);
    });
    void Promise.race([Promise.all(settled), timeout]).then(() => {
      if (cancelled) return;
      if (deadline) clearTimeout(deadline);
      setProgress(100);
      setPhase("leaving");
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      timer = setTimeout(finish, reduced ? 0 : 380);
    });
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", keepFocus, true);
      if (timer) clearTimeout(timer);
      if (deadline) clearTimeout(deadline);
      if (previousOverflow !== undefined)
        document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !root.current) return;
    const container = root.current;
    const media = window.matchMedia(
      "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
    );
    let entryObserver: IntersectionObserver | undefined;
    let exitObserver: IntersectionObserver | undefined;
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>(
        ":scope > section:not(.home-hero)",
      ),
    );
    const children = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".home-section-reveal, .home-reveal-item, .home-mobile-depth",
      ),
    );
    const clean = () => {
      entryObserver?.disconnect();
      exitObserver?.disconnect();
      sections.forEach((section) => {
        section.removeAttribute("data-depth-state");
        section.removeAttribute("data-depth-pattern");
      });
      children.forEach((child) => child.removeAttribute("data-depth-child"));
    };
    const setup = () => {
      clean();
      if (!media.matches || !("IntersectionObserver" in window)) return;
      const entryInset = Math.round(window.innerHeight * 0.08);
      const setState = (target: HTMLElement, state: "entered" | "waiting") => {
        if (target.hasAttribute("data-depth-child"))
          target.dataset.depthChild = state;
        else target.dataset.depthState = state;
      };
      entryObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement;
              setState(target, "entered");
            }
          });
        },
        {
          threshold: 0,
          rootMargin: `-${entryInset}px 0px -${entryInset}px 0px`,
        },
      );
      // Hysteresis: only re-arm once the entire target has cleared the
      // viewport by 120px. Entry transforms stay well inside this buffer.
      // Keep both observers attached so upward and downward revisits replay.
      exitObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting)
              setState(entry.target as HTMLElement, "waiting");
          });
        },
        { threshold: 0, rootMargin: "120px 0px 120px 0px" },
      );
      const initialState = (target: HTMLElement) => {
        const rect = target.getBoundingClientRect();
        return rect.bottom > entryInset &&
          rect.top < window.innerHeight - entryInset
          ? "entered"
          : "waiting";
      };
      sections.forEach((section, index) => {
        section.dataset.depthPattern = String(index % 3);
        // Never hide content already being read after returning to this page.
        section.dataset.depthState = initialState(section);
        entryObserver?.observe(section);
        exitObserver?.observe(section);
      });
      children.forEach((child) => {
        child.dataset.depthChild = initialState(child);
        entryObserver?.observe(child);
        exitObserver?.observe(child);
      });
    };
    setup();
    media.addEventListener("change", setup);
    return () => {
      clean();
      media.removeEventListener("change", setup);
    };
  }, [phase]);

  return (
    <div
      ref={root}
      className="home-content"
      data-home-loading={phase !== "ready"}
      data-home-phase={phase}
    >
      {children}
      {phase !== "ready" && (
        <div
          ref={loader}
          role="dialog"
          aria-modal="true"
          aria-label={t("loading")}
          tabIndex={-1}
          className="home-entry-loader fixed inset-0 z-[200] flex flex-col items-center justify-center gap-10 bg-background px-6 text-foreground outline-none"
        >
          <BrandMark height={64} priority label={brand("logoAlt")} />
          <div className="w-full max-w-52 text-center">
            <p className="text-xs tracking-wide text-muted-foreground">
              {progress === 100 ? t("ready") : t("loading")}
            </p>
            <p
              aria-hidden="true"
              className="mt-3 font-mono text-2xl tabular-nums"
            >
              {new Intl.NumberFormat(locale, { style: "percent" }).format(
                progress / 100,
              )}
            </p>
            <progress
              aria-label={t("loading")}
              value={progress}
              max={100}
              className="home-entry-progress mt-4 h-0.5 w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
