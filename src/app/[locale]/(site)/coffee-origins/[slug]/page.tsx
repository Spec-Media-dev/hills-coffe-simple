import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SafeMarkdown } from "@/components/content/safe-markdown";
import { OfferCard } from "@/components/catalog/offer-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getOfferList } from "@/lib/data/catalog";
import { getOriginBySlug } from "@/lib/data/editorial";
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
  const [origin, catalog] = await Promise.all([
    getOriginBySlug(slug, locale as Locale),
    getOfferList(locale as Locale),
  ]);
  if (!origin) notFound();
  const offers = catalog.offers.filter((x) => x.originSlug === slug);
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
      {offers.length ? (
        <section className="section-space bg-page">
          <div className="site-container">
            <h2 className="display-lg">{originsT("availableCoffees")}</h2>
            <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((item) => (
                <OfferCard key={item.id} item={item} labels={labels} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
