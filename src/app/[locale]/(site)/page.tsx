import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, Globe2, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import {
  FeaturedCoffeeSection,
  WarehouseSection,
} from "@/components/content/entity-sections";
import {
  ImageReveal,
  PageReveal,
  SectionReveal,
} from "@/components/motion/primitives";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOfferList } from "@/lib/data/catalog";
import { getArticles, getOrigins } from "@/lib/data/editorial";
import {
  getSitePage,
  getSiteSettings,
  getWarehouses,
} from "@/lib/data/site-content";
import {
  cmsMetadata,
  localizedMetadata,
  localizedUrl,
} from "@/lib/seo/metadata";
import { organizationAndWebsiteJsonLd } from "@/lib/seo/organization";
import { publicContinentLabel } from "@/lib/public-labels";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  const page = await getSitePage("home", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/");
  return localizedMetadata({
    locale: locale as Locale,
    path: "/",
    title: meta("homeTitle"),
    description:
      locale === "ar"
        ? "اكتشف القهوة الخضراء المتاحة عبر مستودعات هيلز كوفي."
        : "Explore green coffee available through Hills Coffee warehouses.",
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const actions = await getTranslations("actions");
  const nav = await getTranslations("nav");
  const catalogT = await getTranslations("catalog");
  const [page, catalog, origins, warehouses, articles, settings] =
    await Promise.all([
      getSitePage("home", locale as Locale),
      getOfferList(locale as Locale),
      getOrigins(locale as Locale),
      getWarehouses(locale as Locale),
      getArticles(locale as Locale),
      getSiteSettings(locale as Locale),
    ]);
  const siteUrl = localizedUrl(locale as Locale, "/");
  const jsonLd = organizationAndWebsiteJsonLd({
    locale: locale as Locale,
    siteUrl,
    settings,
  });
  const copy =
    locale === "ar"
      ? {
          featuredEmpty: "لا توجد محاصيل مميزة منشورة حالياً.",
          originsTitle: "من الحقل إلى قرار الشراء.",
          originsBody: "تعرّف على الأماكن والسياقات التي تشكل كل محصول منشور.",
          originsEmpty: "لا توجد مناشئ منشورة حالياً.",
          qualityEyebrow: "الجودة في سياقها",
          warehouseEmpty: "لا توجد مستودعات منشورة حالياً.",
          accountEyebrow: "حساب هيلز كوفي",
          accountTitle: "احفظ اختياراتك وتابع طلباتك.",
          accountBody:
            "الحساب المؤكد يفتح الأسعار المحمية والمفضلة والطلبات المتابعة.",
          knowledgeTitle: "أحدث المعرفة",
          knowledgeEmpty: "لا توجد مقالات منشورة حالياً.",
        }
      : {
          featuredEmpty: "No featured coffees are published right now.",
          originsTitle: "From place to buying decision.",
          originsBody:
            "Explore the places and contexts behind every published coffee.",
          originsEmpty: "No origins are published right now.",
          qualityEyebrow: "Quality in context",
          warehouseEmpty: "No warehouse locations are published right now.",
          accountEyebrow: "Your Hills Coffee account",
          accountTitle: "Save coffees. Follow every request.",
          accountBody:
            "A verified account unlocks protected pricing, favourites, and tracked requests.",
          knowledgeTitle: "Latest knowledge",
          knowledgeEmpty: "No articles are published right now.",
        };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PageReveal>
        {page ? (
          <CmsPageView page={page} />
        ) : (
          <section className="home-hero relative isolate min-h-[calc(100svh-5rem)] overflow-hidden bg-primary text-primary-foreground">
            <Image
              src="/images/hero-banner.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,45,36,.96)_0%,rgba(23,60,50,.78)_50%,rgba(23,60,50,.22)_100%)] rtl:scale-x-[-1]" />
            <div className="site-container relative flex min-h-[calc(100svh-5rem)] items-end py-14 md:py-20">
              <div className="max-w-6xl">
                <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
                <h1 className="display-hero mt-7 max-w-6xl">{t("title")}</h1>
                <div className="mt-8 grid max-w-4xl gap-7 border-t border-white/25 pt-7 md:grid-cols-[1fr_auto] md:items-end">
                  <p className="max-w-2xl text-base leading-7 text-white/76 md:text-lg">
                    {t("intro")}
                  </p>
                  <Link
                    href="/green-coffee-offer-list"
                    className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold px-6 py-3 text-sm font-bold text-[#0b241d]"
                  >
                    {actions("explore")}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </PageReveal>

      <section className="section-space overflow-hidden">
        <div className="site-container grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <SectionReveal>
            <p className="eyebrow">{t("source")}</p>
            <h2 className="display-lg mt-5">{t("story")}</h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              {t("sourceBody")}
            </p>
            <Link
              href="/about"
              className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-highlight pb-1 text-sm font-bold text-highlight"
            >
              {actions("learn")}
              <ArrowUpRight
                className="size-4 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </Link>
          </SectionReveal>
          <ImageReveal className="relative aspect-[5/4] bg-muted">
            <Image
              src="/images/coffee-cherry.jpg"
              alt=""
              fill
              sizes="(min-width:1024px) 55vw, 100vw"
              className="object-cover"
            />
            <div className="absolute bottom-0 start-0 max-w-xs bg-gold p-6 text-[#17251c]">
              <ShieldCheck className="size-6" aria-hidden="true" />
              <p className="mt-4 font-heading text-2xl font-bold leading-tight">
                {t("source")}
              </p>
            </div>
          </ImageReveal>
        </div>
      </section>

      <FeaturedCoffeeSection
        offers={catalog.offers}
        title={t("featured")}
        intro={t("featuredBody")}
        empty={copy.featuredEmpty}
        bagsLabel={catalogT("bags")}
      />

      <section className="section-space bg-page">
        <div className="site-container">
          <SectionReveal className="grid gap-8 md:grid-cols-[1fr_.7fr] md:items-end">
            <div>
              <p className="eyebrow">{nav("origins")}</p>
              <h2 className="display-lg mt-5 max-w-4xl">{copy.originsTitle}</h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              {copy.originsBody}
            </p>
          </SectionReveal>
          {origins.length ? (
            <div className="mt-12 grid border-s border-t border-border sm:grid-cols-2 lg:grid-cols-4">
              {origins.slice(0, 4).map((origin, index) => (
                <SectionReveal key={origin.id} delay={index * 0.05}>
                  <Link
                    href={`/coffee-origins/${origin.slug}`}
                    className="group flex min-h-72 flex-col justify-between border-e border-b border-border p-6 hover:bg-card"
                  >
                    <span className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Globe2
                        className="size-5 text-highlight"
                        aria-hidden="true"
                      />
                    </span>
                    <span>
                      <span className="eyebrow">
                        {publicContinentLabel(
                          origin.continent,
                          locale as Locale,
                        )}
                      </span>
                      <span
                        lang={origin.lang}
                        className="mt-4 block font-heading text-4xl font-bold"
                      >
                        {origin.name}
                      </span>
                    </span>
                  </Link>
                </SectionReveal>
              ))}
            </div>
          ) : (
            <p className="empty-state mt-12">{copy.originsEmpty}</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden bg-primary text-primary-foreground">
        <div className="site-container grid lg:grid-cols-2">
          <ImageReveal className="relative min-h-[28rem] lg:min-h-[42rem]">
            <Image
              src="/images/cupping-lab.jpg"
              alt=""
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover"
            />
          </ImageReveal>
          <SectionReveal className="flex min-h-[32rem] flex-col justify-center py-16 lg:px-16">
            <p className="eyebrow !text-gold-contrast">{copy.qualityEyebrow}</p>
            <h2 className="display-lg mt-6">{t("sustain")}</h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/68">
              {t("sustainBody")}
            </p>
          </SectionReveal>
        </div>
      </section>

      <WarehouseSection
        warehouses={warehouses}
        title={t("network")}
        intro={t("networkBody")}
        empty={copy.warehouseEmpty}
      />

      <section className="section-space bg-gold text-[#17251c]">
        <SectionReveal className="site-container grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow !text-[#3b260f]">{copy.accountEyebrow}</p>
            <h2 className="display-lg mt-5 max-w-4xl">{copy.accountTitle}</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#1b3027]">
              {copy.accountBody}
            </p>
          </div>
          <Link
            href="/sign-up"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-7 py-3 text-sm font-bold text-primary-foreground"
          >
            {actions("continue")}
            <ArrowUpRight
              className="size-4 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </Link>
        </SectionReveal>
      </section>

      <section className="section-space">
        <div className="site-container">
          <SectionReveal className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{nav("knowledge")}</p>
              <h2 className="display-lg mt-5">{copy.knowledgeTitle}</h2>
            </div>
            <Link
              href="/knowledge"
              className="hidden font-bold text-highlight sm:block"
            >
              {actions("learn")} →
            </Link>
          </SectionReveal>
          {articles.length ? (
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {articles.slice(0, 3).map((article, index) => (
                <SectionReveal key={article.id} delay={index * 0.05}>
                  <Link
                    href={`/knowledge/${article.slug}`}
                    className="group block border-t border-border pt-5"
                  >
                    {article.featuredMedia ? (
                      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                        <Image
                          src={article.featuredMedia.url}
                          alt={article.featuredMedia.alt}
                          fill
                          unoptimized
                          sizes="(min-width:1024px) 32vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-[16/10] place-items-center bg-primary text-primary-foreground">
                        <BookOpen
                          className="size-8 text-gold-bright"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    <h3
                      lang={article.lang}
                      className="mt-6 font-heading text-2xl font-bold leading-tight"
                    >
                      {article.title}
                    </h3>
                  </Link>
                </SectionReveal>
              ))}
            </div>
          ) : (
            <p className="empty-state mt-12">{copy.knowledgeEmpty}</p>
          )}
        </div>
      </section>
    </>
  );
}
