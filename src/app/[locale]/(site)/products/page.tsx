import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CatalogExplorer } from "@/components/catalog/catalog-explorer";
import { getViewer } from "@/lib/auth/session";
import { catalogForViewer } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Green coffee catalog",
  description:
    "Browse specialty and commercial green coffee available from Hills Coffee warehouses in Egypt and Dubai.",
};

export default async function ProductsPage({
  searchParams,
}: PageProps<"/[locale]/products">) {
  const query = await searchParams;
  const t = await getTranslations("catalog");
  const actions = await getTranslations("actions");
  const nav = await getTranslations("nav");
  const viewer = await getViewer();
  const labels = {
    search: t("search"),
    filters: t("filters"),
    origin: t("origin"),
    process: t("process"),
    location: t("location"),
    certification: t("certification"),
    availability: t("availability"),
    category: t("category"),
    sort: t("sort"),
    showing: t("showing", { count: "{count}" }),
    coffee: t("coffee"),
    profile: t("profile"),
    offer: t("offer"),
    bags: t("bags"),
    details: t("details"),
    noResults: t("noResults"),
    reset: t("reset"),
    pricing: actions("pricing"),
    view: actions("view"),
    all: nav("all"),
    specialty: nav("specialty"),
    commercial: nav("commercial"),
  };
  return (
    <>
      <section className="border-b border-border bg-primary py-16 text-primary-foreground md:py-24">
        <div className="site-container">
          <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
          <h1 className="display-lg mt-5 max-w-4xl">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68">
            {t("intro")}
          </p>
        </div>
      </section>
      <CatalogExplorer
        coffees={catalogForViewer(viewer)}
        labels={labels}
        initialLocation={
          typeof query.location === "string" ? query.location : undefined
        }
      />
    </>
  );
}
