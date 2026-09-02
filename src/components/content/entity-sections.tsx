import { ArrowUpRight, MapPin, PackageOpen } from "lucide-react";
import type { OfferListItem } from "@/lib/data/catalog";
import type { AwaitedReturn } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { SectionReveal } from "@/components/motion/primitives";

type Warehouses = AwaitedReturn<
  typeof import("@/lib/data/site-content").getWarehouses
>;
export function FeaturedCoffeeSection({
  offers,
  title,
  intro,
  empty,
  bagsLabel,
}: {
  offers: OfferListItem[];
  title: string;
  intro?: string;
  empty?: string;
  bagsLabel: string;
}) {
  const unique = [
    ...new Map(
      offers
        .filter((x) => x.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder)
        .map((x) => [x.coffeeId, x]),
    ).values(),
  ].slice(0, 4);
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
            <ArrowUpRight className="size-4" />
          </Link>
        </SectionReveal>
        {unique.length ? (
          <div className="mt-10 grid border-s border-t border-border md:grid-cols-2 xl:grid-cols-4">
            {unique.map((item) => (
              <Link
                key={item.coffeeId}
                href={`/green-coffee-offer-list/${item.slug}`}
                className="group min-h-72 border-e border-b border-border bg-card p-6 transition-colors hover:bg-page"
              >
                <p className="eyebrow">{item.origin}</p>
                <h3 lang={item.nameLang} className="mt-10 text-3xl">
                  {item.name}
                </h3>
                <p className="mt-4 text-sm text-muted-foreground">
                  {item.process}
                  {item.cupScore ? ` · ${item.cupScore}` : ""}
                </p>
                <p className="mt-12 flex items-center gap-2 text-sm">
                  <PackageOpen className="size-4 text-highlight" />
                  {item.bags} {bagsLabel} · {item.warehouse}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state mt-10">{empty}</p>
        )}
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
