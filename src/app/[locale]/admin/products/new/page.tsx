import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CoffeeForm } from "@/components/admin/coffee-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCatalogFormOptions } from "@/lib/data/admin-catalog";

export const metadata: Metadata = {
  title: "New coffee",
  robots: { index: false, follow: false },
};

export default async function NewCoffeePage({
  params,
}: PageProps<"/[locale]/admin/products/new">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.catalog");
  const options = await getCatalogFormOptions(locale);

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/products"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("backToList")}
      </Link>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("newCoffee")}</h1>
      {/* Images attach to a coffee row, so they become available after save. */}
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {t("saveImagesFirst")}
      </p>
      <CoffeeForm options={options} />
    </div>
  );
}
