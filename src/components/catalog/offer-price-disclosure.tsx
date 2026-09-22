"use client";

import { Popover } from "@base-ui/react/popover";
import { CircleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";

type Tier = { minBags: number; pricePerKgUsd: number };

function subscribeFinePointer(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(hover: hover) and (pointer: fine)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getFinePointerSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function getServerFinePointerSnapshot(): boolean {
  return false;
}

export function OfferPriceDisclosure({
  tiers,
  labels,
}: {
  tiers: Tier[];
  labels: {
    trigger: string;
    title: string;
    close: string;
    bags: string;
    perKg: string;
  };
}) {
  const isFinePointer = useSyncExternalStore(
    subscribeFinePointer,
    getFinePointerSnapshot,
    getServerFinePointerSnapshot,
  );

  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        openOnHover={isFinePointer}
        delay={100}
        closeDelay={150}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/45 bg-gold/10 px-3.5 py-2 text-sm font-bold text-highlight transition-[background-color,border-color,color] duration-150 hover:border-gold hover:bg-gold/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{labels.trigger}</span>
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Backdrop className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden" />
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          className="isolate z-50"
        >
          <Popover.Popup
            aria-label={labels.title}
            className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-5 text-foreground shadow-[0_24px_60px_rgb(7_28_21/.3)] outline-none duration-150 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-extrabold">{labels.title}</p>
              <Popover.Close
                aria-label={labels.close}
                className="grid size-7 place-items-center rounded-full border border-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Popover.Close>
            </div>
            <dl className="mt-3 divide-y divide-border border-y border-border">
              {tiers.map((tier) => (
                <div
                  key={tier.minBags}
                  className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
                >
                  <dt className="font-semibold text-muted-foreground">
                    {tier.minBags}+ {labels.bags}
                  </dt>
                  <dd className="font-extrabold text-highlight" dir="ltr">
                    ${tier.pricePerKgUsd.toFixed(2)}{labels.perKg}
                  </dd>
                </div>
              ))}
            </dl>
            <Popover.Arrow className="z-50 size-2.5 rotate-45 border border-border bg-card data-[side=top]:-bottom-1.5 data-[side=top]:border-s-0 data-[side=top]:border-t-0 data-[side=bottom]:-top-1.5 data-[side=bottom]:border-e-0 data-[side=bottom]:border-b-0" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
