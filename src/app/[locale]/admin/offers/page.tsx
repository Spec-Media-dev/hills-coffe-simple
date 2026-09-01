import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listAdminOffers } from "@/lib/data/admin-catalog";

export const metadata: Metadata = {
  title: "Offers",
  robots: { index: false, follow: false },
};

export default async function AdminOffersPage({
  params,
}: PageProps<"/[locale]/admin/offers">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.catalog");
  const ops = await getTranslations("admin.ops");
  const rows = await listAdminOffers(locale);

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{ops("operations")}</p>
          <h1 className="mt-4 text-4xl md:text-5xl">{t("offers")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t("offersIntro")}
          </p>
        </div>
        <Link
          href="/admin/offers/new"
          className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("newOffer")}
        </Link>
      </div>

      {rows.length ? (
        <div className="mt-7 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-start font-bold">
                  {t("referenceNumber")}
                </th>
                <th className="p-4 text-start font-bold">{t("coffee")}</th>
                <th className="p-4 text-start font-bold">{t("warehouse")}</th>
                <th className="p-4 text-start font-bold">{t("status")}</th>
                <th className="p-4 text-start font-bold">
                  {t("bagsQuantity")}
                </th>
                <th className="p-4 text-start font-bold">{t("pricing")}</th>
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
                      href={`/admin/offers/${row.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                      dir="ltr"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  <td className="p-4">{row.coffeeName || "—"}</td>
                  <td className="p-4">{row.warehouseName || "—"}</td>
                  <td className="p-4">
                    {row.status}
                    {row.visible ? null : (
                      <span className="ms-2 text-xs text-muted-foreground">
                        ({t("hidden")})
                      </span>
                    )}
                  </td>
                  <td className="p-4">{row.bags}</td>
                  <td className="p-4">{row.tierCount}</td>
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
