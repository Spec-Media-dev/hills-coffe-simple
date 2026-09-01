import Image from "next/image";
import { MapPin, PackageOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CatalogRow } from "@/lib/data/catalog-query";

/**
 * A catalog result card.
 *
 * `price` is supplied only when the viewer passed the protected-pricing gate;
 * for everyone else it is `undefined` and the card renders the locked label.
 * The component never reads a price itself, so it cannot leak one.
 */
export function CatalogCard({
  item,
  price,
  labels,
}: {
  item: CatalogRow;
  price?: number;
  labels: { bags: string; pricing: string; view: string };
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:border-highlight">
      <div className="relative aspect-4/3 bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center text-4xl opacity-30"
          >
            ☕
          </span>
        )}
        {item.cupScore ? (
          <span className="absolute top-3 end-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            {item.cupScore}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow">{item.origin}</p>
        <h2 className="mt-4 text-2xl">{item.name}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {[item.region, item.process, item.grade].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-6 grid gap-2 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-highlight" aria-hidden="true" />
            {item.warehouse}
          </p>
          <p className="flex items-center gap-2">
            <PackageOpen className="size-4 text-highlight" aria-hidden="true" />
            {item.bags} {labels.bags} · {item.bagWeightKg} kg
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-8">
          <div>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {item.reference}
            </p>
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
      </div>
    </article>
  );
}
