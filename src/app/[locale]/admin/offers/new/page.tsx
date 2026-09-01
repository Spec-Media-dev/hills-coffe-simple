import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { OfferForm } from "@/components/admin/offer-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCatalogFormOptions } from "@/lib/data/admin-catalog";

export const metadata: Metadata = {
  title: "New offer",
  robots: { index: false, follow: false },
};

export default async function NewOfferPage({
  params,
}: PageProps<"/[locale]/admin/offers/new">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.catalog");
  const options = await getCatalogFormOptions(locale);
  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/offers"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("backToList")}
      </Link>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("newOffer")}</h1>
      <OfferForm options={options} />
    </div>
  );
}
