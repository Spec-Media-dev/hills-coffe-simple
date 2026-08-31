import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Coffee,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getAdminDashboard } from "@/lib/data/admin";

export default async function AdminPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const t = await getTranslations("admin");
  const data = await getAdminDashboard(locale as Locale);
  const stats: Array<{ icon: LucideIcon; label: string; value: number }> = [
    { icon: Coffee, label: t("products"), value: data.products },
    { icon: Boxes, label: t("stock"), value: data.bags },
    { icon: AlertTriangle, label: t("low"), value: data.low },
    { icon: ClipboardList, label: t("open"), value: data.open },
  ];
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <div className="p-5 md:p-8">
      <header className="max-w-3xl">
        <p className="eyebrow">{t("protected")}</p>
        <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("intro")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.configured ? t("dashboardSubtitle") : t("notConfigured")}
        </p>
      </header>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-5 transition hover:border-gold/50"
          >
            <Icon className="size-5 text-highlight" aria-hidden="true" />
            <strong className="mt-7 block text-4xl tabular-nums">
              {numberFormat.format(value)}
            </strong>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="eyebrow">{t("activity")}</h2>
        {data.activity.length ? (
          <div className="mt-6 divide-y divide-border">
            {data.activity.map((row) => (
              <div
                key={row.id}
                className="grid gap-1 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center"
              >
                <strong className="truncate">{row.primary}</strong>
                <span className="truncate text-sm text-muted-foreground">
                  {row.secondary}
                </span>
                <time className="text-xs text-muted-foreground">
                  {row.detail}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {data.configured ? t("emptyActivity") : t("notConfigured")}
          </p>
        )}
      </section>
    </div>
  );
}
