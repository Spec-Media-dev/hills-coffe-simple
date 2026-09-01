import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SafeMarkdown } from "@/components/content/safe-markdown";
import { CatalogCard } from "@/components/catalog/catalog-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { queryCatalog } from "@/lib/data/catalog-query";
import { getOriginBySlug, getOriginRegions } from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/coffee-origins/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const origin = await getOriginBySlug(slug, locale as Locale);
  return origin
    ? localizedMetadata({
        locale: locale as Locale,
        path: `/coffee-origins/${slug}`,
        title: origin.seoTitle || origin.name,
        description: origin.seoDescription || origin.summary || undefined,
      })
    : {};
}
export default async function OriginPage({
  params,
}: PageProps<"/[locale]/coffee-origins/[slug]">) {
  const { locale, slug } = await params;
  const seo = await getTranslations("seo");
  const originsT = await getTranslations("origins");
  const origin = await getOriginBySlug(slug, locale as Locale);
  if (!origin) notFound();
  // Scoped to this origin by the database rather than fetched whole and
  // filtered in JavaScript, matching the catalog listing (P6-T01/T04).
  const [catalog, regions] = await Promise.all([
    queryCatalog(locale as Locale, { origin: slug, page: 1 }),
    getOriginRegions(origin.id, locale as Locale),
  ]);
  const offers = catalog.rows;
  const labels =
    locale === "ar"
      ? { bags: "كيس", pricing: "سجّل الدخول لعرض السعر", view: "عرض المحصول" }
      : {
          bags: "bags",
          pricing: "Sign in to view pricing",
          view: "View coffee",
        };
  return (
    <>
      <section className="section-space bg-primary text-primary-foreground">
        <div className="site-container">
          <Breadcrumbs
            locale={locale as Locale}
            items={[
              {
                label: seo("originsTitle"),
                href: "/coffee-origins",
              },
              { label: origin.name },
            ]}
            inverted
          />
          <p className="eyebrow !text-gold-contrast">{origin.continent}</p>
          <h1 lang={origin.lang} className="display-xl mt-6">
            {origin.name}
          </h1>
          {origin.summary ? (
            <p className="mt-7 max-w-3xl text-lg leading-8 text-white/70">
              {origin.summary}
            </p>
          ) : null}
        </div>
      </section>
      <section className="section-space">
        <div className="site-container grid gap-12 lg:grid-cols-2">
          {origin.story ? (
            <div>
              <h2 className="text-4xl">{originsT("sourcingStory")}</h2>
              <SafeMarkdown className="prose-hills mt-6">
                {origin.story}
              </SafeMarkdown>
            </div>
          ) : null}
          {origin.cultivation ? (
            <div>
              <h2 className="text-4xl">
                {locale === "ar"
                  ? "الزراعة والمعالجة"
                  : "Cultivation and processing"}
              </h2>
              <SafeMarkdown className="prose-hills mt-6">
                {origin.cultivation}
              </SafeMarkdown>
            </div>
          ) : null}
        </div>
      </section>
      {regions.length ? (
        <section className="border-t border-border py-10">
          <div className="site-container">
            <h2 className="eyebrow">{originsT("regions")}</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {regions.map((region) => (
                <li
                  key={region.id}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm"
                >
                  {region.name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {offers.length ? (
        <section className="section-space bg-page">
          <div className="site-container">
            <h2 className="display-lg">{originsT("availableCoffees")}</h2>
            <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((item) => (
                <CatalogCard key={item.id} item={item} labels={labels} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
