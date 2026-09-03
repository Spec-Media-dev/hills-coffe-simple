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
    description: meta("homeDescription"),
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
        empty={t("featuredEmpty")}
        bagsLabel={catalogT("bags")}
      />

      <section className="section-space bg-page">
        <div className="site-container">
          <SectionReveal className="grid gap-8 md:grid-cols-[1fr_.7fr] md:items-end">
            <div>
              <p className="eyebrow">{nav("origins")}</p>
              <h2 className="display-lg mt-5 max-w-4xl">{t("originsTitle")}</h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              {t("originsBody")}
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
            <p className="empty-state mt-12">{t("originsEmpty")}</p>
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
            <p className="eyebrow !text-gold-contrast">{t("qualityEyebrow")}</p>
            <h2 className="display-lg mt-6">{t("sustain")}</h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/68">
              {t("sustainBody")}
            </p>
          </SectionReveal>
        </div>
      </section>

      <WarehouseSection
        // Dubai-first positioning (OA-T07). The warehouse rows themselves are
        // untouched — this only decides which card a reader meets first.
        warehouses={[...warehouses].sort((a, b) =>
          a.code === "DUBAI" ? -1 : b.code === "DUBAI" ? 1 : 0,
        )}
        title={t("network")}
        intro={t("networkBody")}
        empty={t("warehouseEmpty")}
      />

      <section className="section-space bg-page">
        <SectionReveal className="site-container">
          <p className="eyebrow">{t("tradeEyebrow")}</p>
          <h2 className="display-lg mt-5 max-w-4xl">{t("tradeTitle")}</h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            {t("tradeBody")}
          </p>

          <h3 className="mt-14 text-2xl font-bold">{t("stepsTitle")}</h3>
          {/* A real sequence, so it is numbered. */}
          <ol className="mt-7 grid gap-px bg-border md:grid-cols-3">
            {[
              { title: t("step1Title"), body: t("step1Body") },
              { title: t("step2Title"), body: t("step2Body") },
              { title: t("step3Title"), body: t("step3Body") },
            ].map((step, index) => (
              <li
                key={step.title}
                className="flex min-h-56 flex-col bg-card p-7"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-xs font-bold text-highlight"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h4 className="mt-6 text-lg font-bold">{step.title}</h4>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-px grid gap-px bg-border md:grid-cols-2">
            <div className="bg-card p-7">
              <h4 className="text-lg font-bold">{t("traceTitle")}</h4>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t("traceBody")}
              </p>
            </div>
            <div className="bg-card p-7">
              <h4 className="text-lg font-bold">{t("accessTitle")}</h4>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t("accessBody")}
              </p>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/green-coffee-offer-list"
              className="inline-flex h-12 min-h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
            >
              {t("browseLots")}
            </Link>
            {/* "Request an Offer" is CTA wording; the canonical route is
                /request-a-quote and there is no parallel RFQ page. */}
            <Link
              href="/request-a-quote"
              className="inline-flex h-12 min-h-11 items-center rounded-full border border-primary px-6 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              {t("requestOffer")}
            </Link>
          </div>
        </SectionReveal>
      </section>

      <section className="section-space bg-gold text-[#17251c]">
        <SectionReveal className="site-container grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow !text-[#3b260f]">{t("accountEyebrow")}</p>
            <h2 className="display-lg mt-5 max-w-4xl">{t("accountTitle")}</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#1b3027]">
              {t("accountBody")}
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
              <h2 className="display-lg mt-5">{t("knowledgeTitle")}</h2>
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
            <p className="empty-state mt-12">{t("knowledgeEmpty")}</p>
          )}
        </div>
      </section>
    </>
  );
}
