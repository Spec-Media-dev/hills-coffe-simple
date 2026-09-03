import Image from "next/image";
import { ArrowUpRight, MapPin, PackageOpen } from "lucide-react";
import type { OfferListItem } from "@/lib/data/catalog";
import type { AwaitedReturn } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { SectionReveal } from "@/components/motion/primitives";

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

/**
 * Composition follows the number of featured coffees rather than forcing every
 * count into a four-up grid.
 *
 * One featured coffee in a four-column grid left three empty cells and made a
 * deliberate editorial choice look like missing data. One coffee now gets a
 * real feature — a large image beside its specification — and two, three or
 * four fall back to progressively tighter columns.
 */
function layoutFor(count: number) {
  if (count === 1) return "grid-cols-1 lg:grid-cols-[1.1fr_.9fr]";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count === 3) return "grid-cols-1 md:grid-cols-3";
  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
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
  const single = unique.length === 1;

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

        <div
          className={`mt-10 grid border-s border-t border-border ${layoutFor(unique.length)}`}
        >
          {unique.map((item) => {
            const picture = media.get(item.coffeeId);
            return (
              <Link
                key={item.coffeeId}
                href={`/green-coffee-offer-list/${item.slug}`}
                className={`group border-e border-b border-border bg-card transition-colors hover:bg-page ${
                  single
                    ? "grid grid-cols-1 lg:col-span-2 lg:grid-cols-[1.1fr_.9fr]"
                    : "flex flex-col"
                }`}
              >
                {/* Image first on every screen: the coffee is the subject. */}
                {picture ? (
                  <div
                    className={`relative overflow-hidden bg-muted ${single ? "min-h-64 lg:min-h-[26rem]" : "aspect-[4/3]"}`}
                  >
                    <Image
                      src={picture.url}
                      alt={picture.alt}
                      fill
                      unoptimized
                      sizes={
                        single
                          ? "(max-width: 1024px) 100vw, 55vw"
                          : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      }
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  /* A published coffee without media still holds its place —
                     branded, not a broken frame, and never invented imagery. */
                  <div
                    className={`surface-noise flex items-end bg-primary p-6 text-primary-foreground ${single ? "min-h-64 lg:min-h-[26rem]" : "aspect-[4/3]"}`}
                  >
                    <PackageOpen
                      className="size-8 text-gold-bright"
                      aria-hidden="true"
                    />
                  </div>
                )}

                <div
                  className={`flex flex-1 flex-col p-6 ${single ? "justify-center md:p-10" : ""}`}
                >
                  <p className="eyebrow">{item.origin}</p>
                  <h3
                    lang={item.nameLang}
                    className={`mt-3 font-heading font-bold ${single ? "text-4xl leading-tight md:text-5xl" : "text-2xl leading-tight"}`}
                  >
                    {item.name}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.process}
                    {item.cupScore ? ` · ${item.cupScore}` : ""}
                  </p>
                  <p className="mt-5 flex items-center gap-2 text-sm">
                    <PackageOpen
                      className="size-4 shrink-0 text-highlight"
                      aria-hidden="true"
                    />
                    {item.bags} {bagsLabel} · {item.warehouse}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-highlight">
                    {viewLabel}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
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
