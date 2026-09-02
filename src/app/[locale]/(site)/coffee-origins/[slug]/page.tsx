import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SafeMarkdown } from "@/components/content/safe-markdown";
import { CatalogCard } from "@/components/catalog/catalog-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { queryCatalog } from "@/lib/data/catalog-query";
import {
  getOriginBySlug,
  getOriginRegions,
  getPublicOriginMedia,
} from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";
import { publicContinentLabel } from "@/lib/public-labels";

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
  const [catalog, regions, media] = await Promise.all([
    queryCatalog(locale as Locale, { origin: slug, page: 1 }),
    getOriginRegions(origin.id, locale as Locale),
    getPublicOriginMedia(origin.id, locale as Locale),
  ]);
  const offers = catalog.rows;
  const heroMedia =
    media.find((item) => item.role === "HERO") ?? media[0] ?? null;
  const gallery = media.filter((item) => item.id !== heroMedia?.id);
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
      <section className="overflow-hidden bg-gold text-[#17251c]">
        <div className="site-container grid min-h-[42rem] gap-0 lg:grid-cols-[.9fr_1.1fr] lg:items-stretch">
          {heroMedia ? (
            <ImageReveal className="relative order-2 min-h-[28rem] bg-primary lg:order-1 lg:-ms-12">
              <Image
                src={heroMedia.url}
                alt={heroMedia.alt}
                fill
                priority
                unoptimized
                sizes="(min-width:1024px) 48vw, 100vw"
                className="object-cover"
              />
            </ImageReveal>
          ) : (
            <div className="relative order-2 min-h-[28rem] overflow-hidden bg-primary lg:order-1 lg:-ms-12">
              <div
                className="origin-map-field absolute inset-8 border border-white/20 opacity-70"
                aria-hidden="true"
              />
            </div>
          )}
          <SectionReveal className="order-1 flex flex-col justify-center py-14 lg:order-2 lg:px-16 lg:py-20">
            <Breadcrumbs
              locale={locale as Locale}
              items={[
                {
                  label: seo("originsTitle"),
                  href: "/coffee-origins",
                },
                { label: origin.name },
              ]}
            />
            <p className="eyebrow !text-[#3b260f]">
              {publicContinentLabel(origin.continent, locale as Locale)}
            </p>
            <h1 lang={origin.lang} className="display-hero mt-6">
              {origin.name}
            </h1>
            {origin.summary ? (
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[#1b3027]">
                {origin.summary}
              </p>
            ) : null}
          </SectionReveal>
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
      {gallery.length ? (
        <section className="border-y border-border bg-page py-10">
          <div className="site-container grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((item, index) => (
              <ImageReveal
                key={item.id}
                delay={index * 0.05}
                className="relative aspect-[4/3] bg-muted"
              >
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  unoptimized
                  sizes="(min-width:1024px) 32vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover"
                />
              </ImageReveal>
            ))}
          </div>
        </section>
      ) : null}
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
