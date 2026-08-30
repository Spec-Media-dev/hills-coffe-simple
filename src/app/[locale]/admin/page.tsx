import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Coffee,
  TrendingUp,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { coffees } from "@/data/coffees";

export default async function AdminPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const t = await getTranslations("admin");
  const offers = coffees.flatMap((coffee) => coffee.offers);
  const stats = [
    [Coffee, t("products"), coffees.length],
    [Boxes, t("stock"), offers.reduce((n, o) => n + o.bagsAvailable, 0)],
    [
      AlertTriangle,
      t("low"),
      offers.filter((o) => o.bagsAvailable < 30).length,
    ],
    [ClipboardList, t("open"), 0],
  ] as const;
  const bars = [34, 58, 48, 77, 69, 92, 84, 106, 98, 121, 110, 137];
  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{locale === "ar" ? "الإدارة" : "Admin"}</p>
          <h1 className="mt-4 font-heading text-4xl md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("intro")}</p>
        </div>
        <span className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground">
          {locale === "ar" ? "بيانات تشغيلية تجريبية" : "Mock operational data"}
        </span>
      </div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([Icon, label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <Icon className="size-5 text-gold" />
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <strong className="mt-7 block font-heading text-4xl">
              {value}
            </strong>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">
                {locale === "ar" ? "مؤشر التوريد" : "Supply signal"}
              </p>
              <h2 className="mt-3 text-3xl">
                {locale === "ar" ? "الأكياس المتاحة" : "Available bags"}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {locale === "ar" ? "معاينة 12 شهراً" : "12-month preview"}
            </span>
          </div>
          <div className="mt-10 flex h-52 items-end gap-2 border-b border-border px-2">
            {bars.map((bar, index) => (
              <div
                key={index}
                className="group relative flex-1 rounded-t-md bg-primary/85 transition hover:bg-gold"
                style={{ height: `${bar / 1.5}px` }}
              >
                <span className="absolute -top-7 start-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100">
                  {bar}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="eyebrow">{t("activity")}</p>
          <div className="mt-6 grid gap-5">
            {coffees.slice(0, 4).map((coffee, index) => (
              <div
                key={coffee.id}
                className="flex gap-3 border-b border-border pb-4 last:border-0"
              >
                <span className="mt-1 size-2 shrink-0 rounded-full bg-gold" />
                <div>
                  <p className="text-sm font-bold">{coffee.name.en}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Offer inventory reviewed · {index + 1}h ago
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
