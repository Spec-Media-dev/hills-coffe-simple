import { MapPin, PackageOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { OfferListItem } from "@/lib/data/catalog";

export function OfferCard({
  item,
  price,
  labels,
}: {
  item: OfferListItem;
  price?: number;
  labels: { bags: string; pricing: string; view: string };
}) {
  return (
    <article className="group flex h-full flex-col rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:border-highlight">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">{item.origin}</p>
        {item.cupScore ? (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            {item.cupScore}
          </span>
        ) : null}
      </div>
      <h2 lang={item.nameLang} className="mt-8 text-3xl">
        {item.name}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {[item.region, item.process, item.grade].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-8 grid gap-2 text-sm">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-highlight" />
          {item.warehouse}
        </p>
        <p className="flex items-center gap-2">
          <PackageOpen className="size-4 text-highlight" />
          {item.bags} {labels.bags} · {item.bagWeightKg} kg
        </p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-4 pt-10">
        <div>
          <p className="text-xs text-muted-foreground">{item.reference}</p>
          <p className="mt-1 font-bold text-highlight">
            {price == null ? labels.pricing : `$${price.toFixed(2)} / kg`}
          </p>
        </div>
        <Link
          href={`/green-coffee-offer-list/${item.slug}`}
          className="rounded-full bg-primary px-5 py-3 text-xs font-bold text-primary-foreground"
        >
          {labels.view}
        </Link>
      </div>
    </article>
  );
}
