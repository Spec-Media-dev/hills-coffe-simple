import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PriceTierForm } from "@/components/admin/offer-form";
import { DeleteTierButton } from "@/components/admin/delete-tier-button";
import type { Locale } from "@/i18n/routing";
import { getCatalogFormOptions } from "@/lib/data/admin-catalog";
import { getAdminPriceTiers } from "@/lib/data/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage({
  params,
}: PageProps<"/[locale]/admin/pricing">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.catalog");
  const ops = await getTranslations("admin.ops");
  const [options, tiers] = await Promise.all([
    getCatalogFormOptions(locale),
    getAdminPriceTiers(),
  ]);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{ops("operations")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("pricing")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {t("pricingIntro")}
      </p>

      <PriceTierForm options={options} />

      {tiers.length ? (
        <div className="mt-7 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-start font-bold">{t("offer")}</th>
                <th className="p-4 text-start font-bold">{t("minBags")}</th>
                <th className="p-4 text-start font-bold">{t("pricePerKg")}</th>
                <th className="p-4 text-start font-bold">
                  <span className="sr-only">{ops("delete")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr
                  key={tier.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4" dir="ltr">
                    {tier.reference}
                  </td>
                  <td className="p-4 tabular-nums">{tier.minBags}</td>
                  <td className="p-4 tabular-nums">
                    {money.format(tier.price)}
                  </td>
                  <td className="p-4">
                    <DeleteTierButton id={tier.id} label={ops("delete")} />
                  </td>
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
