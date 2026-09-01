import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CoffeeForm } from "@/components/admin/coffee-form";
import { CoffeeImages } from "@/components/admin/coffee-images";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getAdminCoffee,
  getCatalogFormOptions,
} from "@/lib/data/admin-catalog";

export const metadata: Metadata = {
  title: "Edit coffee",
  robots: { index: false, follow: false },
};

export default async function EditCoffeePage({
  params,
}: PageProps<"/[locale]/admin/products/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const t = await getTranslations("admin.catalog");
  const [record, options] = await Promise.all([
    getAdminCoffee(id),
    getCatalogFormOptions(locale),
  ]);
  if (!record) notFound();

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/products"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("backToList")}
      </Link>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("editCoffee")}</h1>
      <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
        {record.slug}
      </p>
      <CoffeeForm options={options} record={record} />
      <CoffeeImages coffeeId={record.id} images={record.images} />
    </div>
  );
}
