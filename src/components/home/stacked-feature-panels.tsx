import Image from "next/image";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export type StackedPanel = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  image: { src: string; alt: string };
  badge?: string;
  action: ReactNode;
};

/**
 * Native sticky sheets: normal flow on phones, progressively overlapping
 * sheets on wider screens. This keeps the tactile stacked composition while
 * avoiding scroll-bound React measurements and animation work.
 */
export function StackedFeaturePanels({ panels }: { panels: StackedPanel[] }) {
  return (
    <div className="site-container flex flex-col gap-6 sm:gap-[6.5rem] lg:gap-[7.5rem]">
      {panels.map((panel, index) => (
        <article
          key={panel.key}
          style={{ zIndex: index + 1 }}
          className="relative isolate flex min-h-[30rem] overflow-hidden rounded-[2rem] bg-primary text-primary-foreground shadow-[0_32px_90px_rgb(10_20_16/.35)] transition-transform duration-500 ease-out sm:sticky sm:top-[6.5rem] sm:h-[min(72svh,42rem)] sm:min-h-[32rem] sm:hover:-translate-y-1 lg:rounded-[2.5rem] motion-reduce:transition-none"
        >
          <div className="absolute inset-0">
            <Image
              src={panel.image.src}
              alt={panel.image.alt}
              fill
              sizes="(min-width: 1280px) 80rem, 100vw"
              className="object-cover"
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-primary/92 via-primary/55 via-[45%] to-primary/10 rtl:bg-gradient-to-l"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-primary/25"
          />

          <div className="relative flex w-full flex-col justify-end p-7 sm:p-10 lg:max-w-[46rem] lg:p-14">
            {panel.badge ? (
              <p className="flex items-center gap-2.5">
                <Lock
                  className="size-3.5 text-gold-contrast"
                  aria-hidden="true"
                />
                <span className="eyebrow !text-gold-contrast">
                  {panel.badge}
                </span>
              </p>
            ) : (
              <p className="eyebrow !text-gold-contrast">{panel.eyebrow}</p>
            )}
            <h3 className="mt-4 font-heading text-4xl leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              {panel.title}
            </h3>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-white/80 md:text-lg md:leading-8">
              {panel.description}
            </p>
            <div className="mt-8">{panel.action}</div>
          </div>
        </article>
      ))}
    </div>
  );
}
