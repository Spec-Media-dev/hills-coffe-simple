import { ArrowUpRight, MapPin } from "lucide-react";
import type { CatalogCoffee } from "@/data/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function CoffeePreview({
  coffee,
  locale,
  viewLabel,
}: {
  coffee: CatalogCoffee;
  locale: Locale;
  viewLabel: string;
}) {
  const name = coffee.name[locale];
  const sensory = coffee.sensory.map((note) => note[locale]);
  return (
    <Link
      href={`/products/${coffee.slug}`}
      className="group relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition duration-500 hover:-translate-y-1.5 hover:border-gold/60 md:p-8"
    >
      <div
        className="absolute -end-16 -top-16 size-48 rounded-full opacity-15 blur-2xl transition duration-700 group-hover:scale-125"
        style={{ background: coffee.color }}
      />
      <div className="relative flex items-start justify-between">
        <span className="eyebrow">{coffee.origin}</span>
        <ArrowUpRight className="size-5 transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
      </div>
      <div className="relative mt-16">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">
          {coffee.process} · {coffee.score ?? "—"}
        </p>
        <h3 className="mt-3 font-heading text-4xl leading-none tracking-[-.04em]">
          {name}
        </h3>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {sensory.join(" · ")}
        </p>
      </div>
      <div className="relative mt-8 flex items-center justify-between border-t border-border pt-5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 text-gold" />
          {coffee.offers.map((offer) => offer.warehouse).join(" · ")}
        </span>
        <span className="font-bold text-gold">{viewLabel}</span>
      </div>
    </Link>
  );
}
