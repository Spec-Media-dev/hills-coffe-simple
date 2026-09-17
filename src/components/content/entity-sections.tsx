import { ArrowUpRight, MapPin } from "lucide-react";
import type { OfferListItem } from "@/lib/data/catalog";
import type { AwaitedReturn } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { SectionReveal } from "@/components/motion/primitives";
import {
  CoffeeHighlightList,
  type CoffeeHighlight,
} from "@/components/home/coffee-highlight-list";

type Warehouses = AwaitedReturn<
  typeof import("@/lib/data/site-content").getWarehouses
>;
/** One image per coffee, keyed by `coffeeId`. */
export type CoffeeMedia = Map<string, { url: string; alt: string }>;

/**
 * The featured set, deduplicated by coffee and capped at four.
 *
 * Exported because the page needs the same list the section will render in
 * order to fetch its imagery in one batch — deriving it twice risks the two
 * drifting apart.
 */
export function featuredCoffeeList(offers: OfferListItem[]): OfferListItem[] {
  return [
    ...new Map(
      offers
        .filter((offer) => offer.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder)
        .map((offer) => [offer.coffeeId, offer]),
    ).values(),
  ].slice(0, 4);
}

export function FeaturedCoffeeSection({
  offers,
  media,
  title,
  intro,
  empty,
  bagsLabel,
  viewLabel,
}: {
  offers: OfferListItem[];
  media: CoffeeMedia;
  title: string;
  intro?: string;
  empty?: string;
  bagsLabel: string;
  viewLabel: string;
}) {
  const unique = featuredCoffeeList(offers);

  /*
   * Nothing featured is a normal state, not a broken one. The full band —
   * display heading, intro, and a page-width dashed box — turned a quiet
   * catalogue into a screen of empty. A single ruled line says the same thing
   * and still offers the way forward.
   */
  if (!unique.length)
    return (
      <section className="border-y border-border bg-background py-9">
        <div className="site-container flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            <b className="font-heading text-base text-foreground">{title}</b>
            {empty ? <span className="ms-3">{empty}</span> : null}
          </p>
          <Link
            href="/green-coffee-offer-list"
            className="inline-flex items-center gap-2 text-sm font-bold text-highlight"
          >
            {title}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </section>
    );

  return (
    <section className="section-space border-y border-border bg-background">
      <div className="site-container">
        <SectionReveal className="flex items-end justify-between gap-5">
          <div>
            <h2 className="display-lg max-w-3xl">{title}</h2>
            {intro ? (
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                {intro}
              </p>
            ) : null}
          </div>
          <Link
            href="/green-coffee-offer-list"
            className="hidden items-center gap-2 font-bold text-highlight sm:flex"
          >
            {title}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </Link>
        </SectionReveal>

        <CoffeeHighlightList
          coffees={unique.map((item): CoffeeHighlight => ({
            id: item.coffeeId,
            slug: item.slug,
            name: item.name,
            nameLang: item.nameLang,
            origin: item.origin,
            process: item.process,
            cupScore: item.cupScore,
            bags: item.bags,
            warehouse: item.warehouse,
            media: media.get(item.coffeeId) ?? null,
          }))}
          bagsLabel={bagsLabel}
          viewLabel={viewLabel}
        />
      </div>
    </section>
  );
}
export function WarehouseSection({
  warehouses,
  title,
  intro,
  empty,
}: {
  warehouses: Warehouses;
  title: string;
  intro: string;
  empty?: string;
}) {
  return (
    <section className="section-space bg-primary text-primary-foreground">
      <div className="site-container">
        <p className="eyebrow !text-gold-contrast">{intro}</p>
        <h2 className="display-lg mt-4 max-w-3xl">{title}</h2>
        {warehouses.length ? (
          <div className="mt-10 grid gap-px bg-white/15 md:grid-cols-2">
            {warehouses.map((warehouse) => (
              <article
                key={warehouse.id}
                lang={warehouse.lang}
                className="relative min-h-72 overflow-hidden bg-primary p-7 md:p-9"
              >
                <MapPin className="size-7 text-gold-bright" />
                <h3 className="mt-10 text-4xl">{warehouse.displayName}</h3>
                <p className="mt-3 text-white/65">
                  {warehouse.displayCity}
                  {warehouse.displayRegion
                    ? ` · ${warehouse.displayRegion}`
                    : ""}
                </p>
                {warehouse.displayAddress ? (
                  <p className="mt-8 max-w-md text-sm leading-6 text-white/55">
                    {warehouse.displayAddress}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-10 border border-dashed border-white/25 p-10 text-center text-white/65">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}
