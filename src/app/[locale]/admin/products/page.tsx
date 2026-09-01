import type { Metadata } from "next";
import { ImageIcon, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listAdminCoffees } from "@/lib/data/admin-catalog";

export const metadata: Metadata = {
  title: "Coffees",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage({
  params,
}: PageProps<"/[locale]/admin/products">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.catalog");
  const ops = await getTranslations("admin.ops");
  const rows = await listAdminCoffees(locale);

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{ops("operations")}</p>
          <h1 className="mt-4 text-4xl md:text-5xl">{t("coffees")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t("coffeesIntro")}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("newCoffee")}
        </Link>
      </div>

      {rows.length ? (
        <div className="mt-7 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-start font-bold">{t("nameEn")}</th>
                <th className="p-4 text-start font-bold">{t("origin")}</th>
                <th className="p-4 text-start font-bold">{t("status")}</th>
                <th className="p-4 text-start font-bold">{t("images")}</th>
                <th className="p-4 text-start font-bold">{t("offers")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4">
                    <Link
                      href={`/admin/products/${row.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span
                      className="mt-1 block text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {row.slug}
                    </span>
                  </td>
                  <td className="p-4">{row.originLabel || "—"}</td>
                  <td className="p-4">{row.status}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5">
                      <ImageIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {row.imageCount}
                    </span>
                  </td>
                  <td className="p-4">{row.offerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-7 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {ops("noRecords")}
        </p>
      )}
    </div>
  );
}
