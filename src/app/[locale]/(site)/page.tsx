import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { HomeHeroLandscape } from "@/components/home/home-hero-landscape";
import {
  StackedFeaturePanels,
  type StackedPanel,
} from "@/components/home/stacked-feature-panels";
import {
  OriginScrollList,
  type OriginRowData,
} from "@/components/home/origin-scroll-list";
import {
  FeaturedCoffeeSection,
  featuredCoffeeList,
} from "@/components/content/entity-sections";
import {
  ImageReveal,
  PageReveal,
  SectionReveal,
} from "@/components/home/home-reveal";
import { AuthCta } from "@/components/auth/auth-cta";
import { getPublicPersona } from "@/lib/auth/persona";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOfferList, getPublicCoffeeHeroMedia } from "@/lib/data/catalog";
import {
  getArticles,
  getOrigins,
  getPublicOriginHeroMedia,
} from "@/lib/data/editorial";
import {
  getSitePage,
  getSiteSettings,
  getWarehouses,
} from "@/lib/data/site-content";
import { env } from "@/lib/env";
import { cmsMetadata, localizedMetadata } from "@/lib/seo/metadata";
import { organizationAndWebsiteJsonLd } from "@/lib/seo/organization";
import { publicContinentLabel } from "@/lib/public-labels";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  const page = await getSitePage("home", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/", true);
  return localizedMetadata({
    locale: locale as Locale,
    path: "/",
    title: meta("homeTitle"),
    description: meta("homeDescription"),
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const actions = await getTranslations("actions");
  const cta = await getTranslations("cta");
  // Presentation state only — the home page grants nothing.
  const persona = await getPublicPersona();
  const nav = await getTranslations("nav");
  const catalogT = await getTranslations("catalog");
  const originsT = await getTranslations("origins");
  const [page, catalog, origins, warehouses, articles, settings] =
    await Promise.all([
      getSitePage("home", locale as Locale),
      getOfferList(locale as Locale),
      getOrigins(locale as Locale),
      getWarehouses(locale as Locale),
      getArticles(locale as Locale),
      getSiteSettings(locale as Locale),
    ]);
  // Both surfaces below show a handful of rows, and both need one image per
  // row. These are batched readers — three queries each, whatever the count —
  // and they run together because neither depends on the other. The origins
  // scroll list renders every published origin (no slice), so its media read
  // covers the full list rather than a fixed first four.
  const featuredCoffees = featuredCoffeeList(catalog.offers);
  const [originHeroMedia, coffeeHeroMedia] = await Promise.all([
    getPublicOriginHeroMedia(
      origins.map((origin) => origin.id),
      locale as Locale,
    ),
    getPublicCoffeeHeroMedia(
      featuredCoffees.map((offer) => offer.coffeeId),
      locale as Locale,
    ),
  ]);
  const originRows: OriginRowData[] = origins.map((origin) => {
    const media = originHeroMedia.get(origin.id);
    return {
      id: origin.id,
      slug: origin.slug,
      name: origin.name,
      lang: origin.lang,
      countryCode: origin.country_code,
      continentLabel: publicContinentLabel(origin.continent, locale as Locale),
      coffeeCountLabel: originsT("coffeeCount", { count: origin.coffeeCount }),
      summary: origin.summary,
      media: media ?? null,
    };
  });

  const jsonLd = organizationAndWebsiteJsonLd({
    locale: locale as Locale,
    // Organization and WebSite are domain-level entities, not one entity per
    // localized homepage, so every locale shares the root identity URL.
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    settings,
  });

  /*
   * The Evidence section's example record — the first published offer this
   * page already loaded, read as a set of labelled facts rather than the
   * abstract field-name list. No new query: `catalog.offers` is the same
   * array `FeaturedCoffeeSection` renders from. `fVariety` has no reliable
   * source column here (`type` is a commercial category, not a botanical
   * variety) and is intentionally left out rather than guessed.
   */
  const exampleOffer = catalog.offers[0] ?? null;
  const exampleFields: [string, string][] | null = exampleOffer
    ? (
        [
          [t("fOrigin"), exampleOffer.origin],
          [t("fRegion"), exampleOffer.region],
          [t("fProcess"), exampleOffer.process],
          [t("fGrade"), exampleOffer.grade],
          [
            t("fScore"),
            exampleOffer.cupScore != null
              ? String(exampleOffer.cupScore)
              : null,
          ],
          [t("fCrop"), exampleOffer.availableFrom],
          [t("fWarehouse"), exampleOffer.warehouse],
          [t("fReference"), exampleOffer.reference],
          [t("fBags"), `${exampleOffer.bags} ${catalogT("bags")}`],
          [
            t("fCerts"),
            exampleOffer.certifications.length
              ? exampleOffer.certifications.join(", ")
              : null,
          ],
        ] as [string, string | null][]
      ).filter((pair): pair is [string, string] => Boolean(pair[1]))
    : null;

  // Dubai-first (OA-T07), computed once and shared by the Supply / Logistics
  // composition below — the same ordering `WarehouseSection` used to apply.
  const sortedWarehouses = [...warehouses].sort((a, b) =>
    a.code === "DUBAI" ? -1 : b.code === "DUBAI" ? 1 : 0,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {page ? (
        <PageReveal>
          <CmsPageView page={page} />
        </PageReveal>
      ) : (
        /*
         * The landscape already owns its composited entry and scroll motion.
         * Avoid a second PageReveal transform around it: nested transforms
         * make the opening frame less settled on slower devices.
         */
        <HomeHeroLandscape
          eyebrow={t("heroEyebrow")}
          title={t("heroTitle")}
          intro={t("heroIntro")}
          beanCtaLabel={t("heroBeanCta")}
          audienceLabel={t("heroAudienceLabel")}
          audience={t("heroAudience")}
          offerLabel={t("heroOfferLabel")}
          offer={t("heroOffer")}
        />
      )}

      {/*
       * The three ways to buy, as sticky-overlapping panels (to-top.ch's
       * service-panel behavior) instead of the previous three-column ledger.
       * The gated third panel keeps its dark ground and its AuthCta — built
       * here, in the server component, since it needs `persona` — and is
       * passed into the client panel component as ready-made markup rather
       * than threading auth state across the server/client boundary.
       */}
      <section className="home-deferred-section border-t border-border bg-page pb-20 md:pb-28 lg:pb-36">
        <SectionReveal className="site-container flex flex-col items-center pt-16 pb-10 text-center md:pt-24 md:pb-14">
          <p className="eyebrow">{t("pathsEyebrow")}</p>
          <h2 className="display-lg mt-6 max-w-4xl">{t("pathsTitle")}</h2>
        </SectionReveal>

        <StackedFeaturePanels
          panels={
            [
              {
                key: "source",
                eyebrow: t("path1Who"),
                title: t("path1Name"),
                description: t("path1What"),
                image: {
                  src: "/images/new%20edit/buying-source-coffee.png",
                  alt: "",
                },
                action: (
                  <Link href="/request-a-quote" className="btn-primary w-fit">
                    {t("path1Action")}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                ),
              },
              {
                key: "lots",
                eyebrow: t("path2Who"),
                title: t("path2Name"),
                description: t("path2What"),
                image: {
                  src: "/images/new%20edit/buying-available-lots.png",
                  alt: "",
                },
                action: (
                  <Link
                    href="/green-coffee-offer-list"
                    className="btn-primary w-fit"
                  >
                    {t("path2Action")}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                ),
              },
              {
                key: "trade",
                eyebrow: t("path3Who"),
                title: t("path3Name"),
                description: t("path3What"),
                badge: t("path3Badge"),
                image: {
                  src: "/images/new%20edit/buying-trade-with-hills.png",
                  alt: "",
                },
                action: (
                  <div className="flex flex-col items-start gap-3">
                    {/*
                     * Outline rather than gold. Gold is the page's signal for
                     * the primary commercial action — requesting samples and
                     * pricing in the hero, and the offer request in the
                     * closing band. This path is the permission-gated one and
                     * stays secondary in emphasis. Destination and persona
                     * map are untouched from the previous layout.
                     */}
                    <AuthCta
                      persona={persona}
                      className="btn-on-dark"
                      map={{
                        anonymous: {
                          label: actions("signin"),
                          href: "/sign-in",
                        },
                        unverified: {
                          label: cta("verifyEmail"),
                          href: "/verify-email",
                        },
                        verified: {
                          label: cta("viewLots"),
                          href: "/green-coffee-offer-list",
                        },
                        blocked: {
                          label: cta("contactSupport"),
                          href: "/contact",
                        },
                        admin: null,
                      }}
                    />
                    {/* A business that is not yet approved needs somewhere to
                        go that already exists — the ordinary commercial
                        request route, no membership workflow. */}
                    <Link
                      href="/request-a-quote"
                      className="text-sm font-bold text-gold-contrast underline-offset-4 hover:underline"
                    >
                      {t("path3Access")}
                    </Link>
                  </div>
                ),
              },
            ] satisfies StackedPanel[]
          }
        />
      </section>

      {/*
       * Coffee Offers moved directly after the three buying paths (was
       * behind the sourcing story and the traceability block). A buyer who
       * already knows they want to browse lots should not have to scroll
       * past two more sections of positioning to reach one.
       */}
      <FeaturedCoffeeSection
        offers={catalog.offers}
        media={coffeeHeroMedia}
        title={t("featured")}
        intro={t("featuredBody")}
        empty={t("featuredEmpty")}
        bagsLabel={catalogT("bags")}
        viewLabel={originsT("viewCoffee")}
      />

      {/*
       * The former gold account band, reduced to a single ruled strip and
       * moved beside the coffees it explains. It used to be a full-width gold
       * campaign band lower on the page, competing with the RFQ journey and
       * implying that registration was the point of the site. This states the
       * one fact a browsing visitor needs — pricing sits behind a verified
       * account — and gets out of the way. The `AuthCta` persona map is
       * copied verbatim from that band; only the surrounding chrome changed.
       */}
      <section className="home-deferred-section border-b border-border bg-page py-8">
        <SectionReveal className="site-container flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-heading text-lg font-bold text-foreground">
              {t("accessTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("accessBody")}
            </p>
          </div>
          <AuthCta
            persona={persona}
            className="btn-secondary shrink-0"
            map={{
              anonymous: {
                label: cta("createAccount"),
                href: "/sign-up",
              },
              unverified: {
                label: cta("verifyEmail"),
                href: "/verify-email",
              },
              // Already has the account this band is advertising.
              verified: { label: cta("goToAccount"), href: "/account" },
              blocked: { label: cta("contactSupport"), href: "/contact" },
              admin: null,
            }}
          >
            <ArrowUpRight
              className="size-4 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </AuthCta>
        </SectionReveal>
      </section>

      {/*
       * Every published origin gets a card. The server still performs the
       * same fixed-cost, batched media lookup; the client component only
       * follows the in-view card to drive the decorative country treatment.
       */}
      <section className="home-deferred-section relative isolate overflow-hidden bg-primary py-20 text-primary-foreground md:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex justify-center opacity-[0.28]"
        >
          <Image
            src="/images/new%20edit/hero-coffee-foreground.png"
            alt=""
            width={1672}
            height={941}
            sizes="100vw"
            className="h-auto w-full min-w-[60rem] max-w-none shrink-0"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary/40 to-primary/10" />
        </div>
        {origins.length ? (
          <OriginScrollList
            origins={originRows}
            eyebrow={nav("origins")}
            title={t("originsTitle")}
            intro={t("originsBody")}
          />
        ) : (
          <div className="site-container">
            <p className="empty-state border-white/15 text-white/70">
              {t("originsEmpty")}
            </p>
          </div>
        )}
      </section>

      {/*
       * Evidence — traceability, sourcing and quality, merged into one
       * section instead of three separate full-height bands that each
       * restated the same promise. The main panel used to list eleven field
       * *names*; it now shows those fields' actual values for one real
       * published lot, with a route to that lot's own page, and only falls
       * back to the bare list when the catalogue has nothing published yet.
       * Altitude, producer name and farm size stay absent — this data model
       * does not carry them, and listing them would be exactly the unearned
       * claim this section exists to argue against.
       */}
      <section className="home-deferred-section section-space-tight bg-page">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16">
            <ImageReveal className="relative aspect-[4/5] bg-muted lg:aspect-[3/4]">
              <Image
                src="/images/hills-evidence-grading.webp"
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 44vw"
                className="object-cover"
              />
            </ImageReveal>

            <SectionReveal>
              <p className="eyebrow">{t("traceEyebrow")}</p>
              <h2 className="display-lg mt-5">{t("traceTitle")}</h2>
              <p className="mt-6 max-w-[60ch] text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
                {t("traceBody")}
              </p>

              {exampleFields && exampleOffer ? (
                <>
                  <dl className="mt-10 grid border-t border-border sm:grid-cols-2">
                    {exampleFields.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-3 border-b border-border py-3 sm:nth-[2n]:border-s sm:nth-[2n]:ps-6 sm:nth-[2n-1]:pe-6"
                      >
                        <dt className="flex items-center gap-3 text-sm leading-6 text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-px w-4 shrink-0 bg-highlight"
                          />
                          {label}
                        </dt>
                        <dd className="text-sm font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link
                    href="/green-coffee-offer-list"
                    className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-highlight"
                  >
                    {originsT("viewCoffee")}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                </>
              ) : (
                <ul className="mt-10 grid border-t border-border sm:grid-cols-2">
                  {[
                    t("fOrigin"),
                    t("fRegion"),
                    t("fProcess"),
                    t("fVariety"),
                    t("fGrade"),
                    t("fScore"),
                    t("fCrop"),
                    t("fWarehouse"),
                    t("fReference"),
                    t("fBags"),
                    t("fCerts"),
                  ].map((field) => (
                    <li
                      key={field}
                      className="flex items-center gap-3 border-b border-border py-3 sm:nth-[2n]:border-s sm:nth-[2n]:ps-6 sm:nth-[2n-1]:pe-6"
                    >
                      <span
                        aria-hidden="true"
                        className="h-px w-4 shrink-0 bg-highlight"
                      />
                      <span className="text-sm leading-6">{field}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm text-muted-foreground">
                <span>
                  <b className="font-heading text-2xl text-foreground tabular-nums">
                    {catalog.offers.length}
                  </b>{" "}
                  {t("traceStatCoffees")}
                </span>
                <span>
                  <b className="font-heading text-2xl text-foreground tabular-nums">
                    {origins.length}
                  </b>{" "}
                  {t("traceStatOrigins")}
                </span>
              </p>
            </SectionReveal>
          </div>

          {/* The former standalone sourcing-story and quality-story bands,
              folded in as a ruled two-column footnote to the evidence above
              rather than two more full-height sections repeating the same
              promise. */}
          <div className="mt-16 grid gap-10 border-t border-border pt-12 md:grid-cols-2 md:gap-14 lg:mt-20 lg:pt-16">
            <SectionReveal className="grid gap-6 sm:grid-cols-[.8fr_1.2fr] sm:items-center">
              <ImageReveal className="relative aspect-[4/3] bg-muted">
                <Image
                  src="/images/hills-origin-relationship.webp"
                  alt=""
                  fill
                  sizes="(min-width:768px) 22vw, 100vw"
                  className="object-cover"
                />
              </ImageReveal>
              <div>
                <p className="eyebrow">{t("source")}</p>
                <h3 className="mt-3 font-heading text-2xl font-bold leading-tight">
                  {t("story")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t("sourceBody")}
                </p>
                <Link
                  href="/about"
                  className="mt-4 inline-flex min-h-9 items-center gap-2 text-sm font-bold text-gold-contrast"
                >
                  {actions("learn")}
                  <ArrowUpRight
                    className="size-4 rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </SectionReveal>
            <SectionReveal delay={0.05}>
              <p className="eyebrow">{t("qualityEyebrow")}</p>
              <h3 className="mt-3 font-heading text-2xl font-bold leading-tight">
                {t("sustain")}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {t("sustainBody")}
              </p>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/*
       * Supply / Logistics — a homepage-specific composition, not the shared
       * `WarehouseSection` (which `/contact` still renders unchanged). The
       * old two-card version showed almost nothing per warehouse and no
       * image at all; this pairs one real logistics photograph with a
       * compact two-location panel and the Dubai/Egypt positioning that used
       * to head the old "How Hills works" band.
       */}
      <section className="home-deferred-section section-space-tight overflow-hidden bg-primary text-primary-foreground">
        <div className="site-container grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ImageReveal className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[28rem]">
            <Image
              src="/images/hills-supply-dubai-port.webp"
              alt=""
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover"
            />
          </ImageReveal>
          <SectionReveal>
            <p className="eyebrow !text-gold-contrast">
              {t("tradeEyebrowWorking")}
            </p>
            <h2 className="display-lg mt-5 max-w-lg">{t("tradeTitle")}</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">
              {t("tradeBody")}
            </p>

            {sortedWarehouses.length ? (
              <dl className="mt-9 grid gap-px border-t border-white/15 bg-white/15 sm:grid-cols-2">
                {sortedWarehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    lang={warehouse.lang}
                    className="bg-primary py-4"
                  >
                    <dt className="flex items-center gap-2 text-sm font-bold">
                      <MapPin
                        className="size-4 shrink-0 text-gold-bright"
                        aria-hidden="true"
                      />
                      {warehouse.displayName}
                    </dt>
                    <dd className="mt-1 ps-6 text-xs text-white/60">
                      {warehouse.displayCity}
                      {warehouse.displayRegion
                        ? ` · ${warehouse.displayRegion}`
                        : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-9 border-t border-white/15 pt-4 text-sm text-white/65">
                {t("warehouseEmpty")}
              </p>
            )}

            {/* The plan's "Discuss delivery requirements" wording is not an
                existing translation key, so this reuses actions.inquire
                ("Get in touch"/"تواصل معنا") — same destination, same
                function, no invented copy. */}
            <Link href="/contact" className="btn-on-dark mt-9 w-fit">
              {actions("inquire")}
              <ArrowUpRight
                className="size-4 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </Link>
          </SectionReveal>
        </div>
      </section>

      <section className="home-deferred-section section-space-tight">
        <div className="site-container">
          <SectionReveal className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{nav("knowledge")}</p>
              <h2 className="display-lg mt-5">{t("knowledgeTitle")}</h2>
            </div>
            {/* Was `hidden sm:block` — made reliably visible, matching the
                audit's "clear library action" direction. */}
            <Link href="/knowledge" className="font-bold text-highlight">
              {actions("learn")} →
            </Link>
          </SectionReveal>
          {articles.length ? (
            articles.length === 1 ? (
              /*
               * One article in a three-column grid left two empty columns and
               * read as an under-filled feed. Composition now follows count,
               * the same principle `FeaturedCoffeeSection` already applies:
               * one article gets a real two-column feature instead of a third
               * of a grid built for three.
               */
              <SectionReveal className="mt-12 grid gap-10 border-t border-border pt-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-16">
                <Link
                  href={`/knowledge/${articles[0].slug}`}
                  className="group block"
                >
                  {articles[0].featuredMedia ? (
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-[4/3]">
                      <Image
                        src={articles[0].featuredMedia.url}
                        alt={articles[0].featuredMedia.alt}
                        fill
                        sizes="(min-width:1024px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-[16/10] place-items-center bg-primary text-primary-foreground lg:aspect-[4/3]">
                      <BookOpen
                        className="size-8 text-gold-bright"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Link>
                <div>
                  <Link href={`/knowledge/${articles[0].slug}`}>
                    <h3
                      lang={articles[0].lang}
                      className="font-heading text-3xl leading-tight font-bold transition-colors hover:text-highlight"
                    >
                      {articles[0].title}
                    </h3>
                  </Link>
                  {articles[0].excerpt ? (
                    <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                      {articles[0].excerpt}
                    </p>
                  ) : null}
                  <Link
                    href={`/knowledge/${articles[0].slug}`}
                    className="mt-6 inline-flex min-h-9 items-center gap-2 text-sm font-bold text-highlight"
                  >
                    {actions("learn")}
                    <ArrowUpRight
                      className="size-4 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </SectionReveal>
            ) : (
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
            )
          ) : (
            <p className="empty-state mt-8">{t("knowledgeEmpty")}</p>
          )}
        </div>
      </section>

      {/*
       * RFQ / Sample CTA — the page's final conversion band. This is what
       * remains of the old "How Hills works" section once its Dubai/Egypt
       * positioning moved into Supply / Logistics above: the three-step
       * sequence and the two commercial actions, now headed by the
       * previously orphaned `home.cta` / `home.ctaBody` pair instead of
       * restating the Dubai-first heading a second time. "Request an offer"
       * is now the visually primary action — the buyer has just read the
       * evidence, the origins and the logistics; this is the ask.
       */}
      <section className="home-deferred-section section-space-tight bg-primary text-primary-foreground">
        <SectionReveal className="site-container">
          <h2 className="display-lg max-w-3xl">{t("cta")}</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
            {t("ctaBody")}
          </p>

          <h3 className="mt-14 text-2xl font-bold">{t("stepsTitle")}</h3>
          {/* A real sequence, so it is numbered. */}
          <ol className="mt-7 grid gap-px bg-white/15 md:grid-cols-3">
            {[
              { title: t("step1Title"), body: t("step1Body") },
              { title: t("step2Title"), body: t("step2Body") },
              { title: t("step3Title"), body: t("step3Body") },
            ].map((step, index) => (
              <li key={step.title} className="flex flex-col bg-primary p-7">
                <span
                  aria-hidden="true"
                  className="font-mono text-xs font-bold text-gold-bright"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h4 className="mt-6 text-lg font-bold">{step.title}</h4>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-9 flex flex-wrap gap-3">
            {/* "Request an Offer" is CTA wording; the canonical route is
                /request-a-quote and there is no parallel RFQ page. */}
            <Link href="/request-a-quote" className="btn-primary">
              {actions("requestOffer")}
            </Link>
            <Link href="/green-coffee-offer-list" className="btn-on-dark">
              {t("browseLots")}
            </Link>
          </div>
        </SectionReveal>
      </section>
    </>
  );
}
