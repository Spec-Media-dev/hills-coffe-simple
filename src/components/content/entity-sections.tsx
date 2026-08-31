import { ArrowUpRight, MapPin, PackageOpen } from "lucide-react";
import type { OfferListItem } from "@/lib/data/catalog";
import type { AwaitedReturn } from "@/lib/types";
import { Link } from "@/i18n/navigation";

type Warehouses = AwaitedReturn<
  typeof import("@/lib/data/site-content").getWarehouses
>;
export function FeaturedCoffeeSection({
  offers,
  title,
}: {
  offers: OfferListItem[];
  title: string;
}) {
  const unique = [
    ...new Map(
      offers
        .filter((x) => x.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder)
        .map((x) => [x.coffeeId, x]),
    ).values(),
  ].slice(0, 4);
  if (!unique.length) return null;
  return (
    <section className="section-space bg-background">
      <div className="site-container">
        <div className="flex items-end justify-between gap-5">
          <h2 className="display-lg max-w-3xl">{title}</h2>
          <Link
            href="/green-coffee-offer-list"
            className="hidden items-center gap-2 font-bold text-highlight sm:flex"
          >
            {title}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {unique.map((item) => (
            <Link
              key={item.coffeeId}
              href={`/green-coffee-offer-list/${item.slug}`}
              className="group min-h-72 rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-highlight"
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
                {item.bags} bags · {item.warehouse}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
export function WarehouseSection({
  warehouses,
  title,
  intro,
}: {
  warehouses: Warehouses;
  title: string;
  intro: string;
}) {
  if (!warehouses.length) return null;
  return (
    <section className="section-space bg-primary text-primary-foreground">
      <div className="site-container">
        <p className="eyebrow !text-gold-contrast">{intro}</p>
        <h2 className="display-lg mt-4 max-w-3xl">{title}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {warehouses.map((warehouse) => (
            <article
              key={warehouse.id}
              lang={warehouse.lang}
              className="relative min-h-72 overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[.06] p-7 md:p-9"
            >
              <MapPin className="size-7 text-gold-bright" />
              <h3 className="mt-10 text-4xl">{warehouse.displayName}</h3>
              <p className="mt-3 text-white/65">
                {warehouse.displayCity}
                {warehouse.displayRegion ? ` · ${warehouse.displayRegion}` : ""}
              </p>
              {warehouse.displayAddress ? (
                <p className="mt-8 max-w-md text-sm leading-6 text-white/55">
                  {warehouse.displayAddress}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
