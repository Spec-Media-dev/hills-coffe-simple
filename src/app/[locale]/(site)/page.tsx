import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  Globe2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { HeroImageRotation } from "@/components/home/hero-image-rotation";
import {
  FeaturedCoffeeSection,
  featuredCoffeeList,
  WarehouseSection,
} from "@/components/content/entity-sections";
import {
  ImageReveal,
  PageReveal,
  SectionReveal,
} from "@/components/motion/primitives";
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
  // and they run together because neither depends on the other.
  const homeOrigins = origins.slice(0, 4);
  const featuredCoffees = featuredCoffeeList(catalog.offers);
  const [originHeroMedia, coffeeHeroMedia] = await Promise.all([
    getPublicOriginHeroMedia(
      homeOrigins.map((origin) => origin.id),
      locale as Locale,
    ),
    getPublicCoffeeHeroMedia(
      featuredCoffees.map((offer) => offer.coffeeId),
      locale as Locale,
    ),
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
          /**
           * The hero is an asymmetric split, not text dropped onto a photo.
           *
           * The sourcing image is composed with its subject to the right and
           * open space to the left, so on LTR it occupies the trailing half and
           * the copy sits in the space the photograph already leaves. RTL is
           * not a mirror: the photograph is never flipped (that would reverse
           * real people and real equipment). Instead the crop moves — see
           * `object-position` below — so the open side of the frame stays
           * beside the text whichever way the page runs.
           */
          <section className="home-hero relative isolate flex flex-col overflow-hidden bg-primary text-primary-foreground lg:min-h-[calc(100svh-5rem)]">
            <div className="relative flex flex-1 flex-col lg:block">
              <div className="relative h-[42vh] min-h-64 w-full lg:absolute lg:inset-y-0 lg:end-0 lg:h-auto lg:min-h-0 lg:w-[52%] lg:border-s lg:border-white/20">
                {/*
                 * Deliberately NOT wrapped in ImageReveal. The first frame is
                 * the LCP element, and ImageReveal rests at
                 * `clip-path: inset(0 0 100%)` until it intersects — making the
                 * largest paint wait on an animation. It also keeps the hero
                 * clear of the Chromium clip-path/IntersectionObserver
                 * interaction fixed earlier.
                 *
                 * Each frame carries its own crop. Neither photograph is ever
                 * mirrored for RTL; the crop moves instead. In the sourcing
                 * frame the buyer stands at the right of the shot with open
                 * space to his left, so LTR favours 72% to seat him near the
                 * page edge, and RTL — where the panel sits on the left of the
                 * screen — pulls back to 58% so he stays in view. The
                 * inspection frame is centre-weighted and needs less shift.
                 */}
                <HeroImageRotation
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  frames={[
                    {
                      src: "/images/hills-sourcing-hero.webp",
                      className:
                        "object-cover object-[72%_center] rtl:object-[58%_center]",
                    },
                    {
                      src: "/images/hills-quality-traceability.webp",
                      className:
                        "object-cover object-[60%_center] rtl:object-[42%_center]",
                    },
                  ]}
                />
                {/*
                 * Blends the photograph into the solid field at the seam. The
                 * seam is the leading edge in LTR and the trailing edge in RTL,
                 * so the gradient flips — and it runs lighter in RTL because
                 * there it falls across the subject rather than open space.
                 */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/45 to-transparent rtl:bg-gradient-to-l rtl:via-primary/20" />
              </div>

              {/* Height comes from the flex parent, so the data strip below is
                  never squeezed out by a hardcoded reservation. */}
              <div className="site-container relative grid lg:h-full lg:grid-cols-[minmax(0,50%)_1fr] lg:items-center">
                <div className="py-12 lg:py-20">
                  <SectionReveal>
                    <p className="eyebrow !text-gold-contrast">
                      {t("heroEyebrow")}
                    </p>
                    <h1 className="display-hero mt-6 text-balance">
                      {t("heroTitle")}
                    </h1>
                  </SectionReveal>
                  <SectionReveal delay={0.1}>
                    <p className="mt-7 max-w-[54ch] text-base leading-8 text-white/78 md:text-lg">
                      {t("heroIntro")}
                    </p>
                  </SectionReveal>
                  <SectionReveal delay={0.18}>
                    <div className="mt-9 flex flex-wrap gap-3">
                      <Link
                        href="/request-a-quote"
                        className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold px-6 py-3 text-sm font-bold text-[#0b241d] transition-colors hover:bg-gold-bright"
                      >
                        {t("heroPrimary")}
                        <ArrowUpRight
                          className="size-4 rtl:-scale-x-100"
                          aria-hidden="true"
                        />
                      </Link>
                      <Link
                        href="/green-coffee-offer-list"
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/35 px-6 py-3 text-sm font-bold transition-colors hover:bg-white/10"
                      >
                        {actions("explore")}
                      </Link>
                    </div>
                  </SectionReveal>
                </div>
              </div>
            </div>

            {/*
             * The first appearance of the ledger motif: four facts a buyer can
             * check, in place of one more line of adjectives.
             */}
            <SectionReveal
              delay={0.26}
              className="relative border-t border-white/20 bg-primary"
            >
              <dl className="site-container grid grid-cols-2 md:grid-cols-4">
                {[
                  [t("heroHubLabel"), t("heroHubValue")],
                  [t("heroOpsLabel"), t("heroOpsValue")],
                  [t("heroTraceLabel"), t("heroTraceValue")],
                  [t("heroSampleLabel"), t("heroSampleValue")],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    // Rules between cells only: the second cell of each mobile
                    // row and every cell after the first once it is a single
                    // four-up row. Logical borders, so RTL needs no override.
                    className="border-white/15 py-5 pe-6 nth-[2n]:border-s nth-[2n]:pe-0 nth-[2n]:ps-6 nth-[n+3]:border-t md:py-6 md:pe-7 md:ps-7 md:nth-[-n+4]:border-t-0 md:nth-[n+2]:border-s md:first:ps-0"
                  >
                    <dt className="text-xs leading-5 text-white/70">{label}</dt>
                    <dd className="mt-1 text-sm font-bold leading-6 md:text-base">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </SectionReveal>
          </section>
        )}
      </PageReveal>

      {/*
       * The three ways to buy, as a decision ledger rather than three cards.
       *
       * They are alternatives, not steps, so they carry no 01/02/03 markers —
       * numbering them would tell a buyer to read them in order. Ruled rows
       * let the eye compare them instead. The third row is the only one on a
       * dark ground: it is permission-gated rather than public, and that one
       * difference carries the public-site/portal separation without a
       * separate section explaining it.
       */}
      <section className="border-t border-border">
        <SectionReveal className="site-container pt-16 pb-10 md:pt-24 md:pb-12">
          <p className="eyebrow">{t("pathsEyebrow")}</p>
          <h2 className="display-lg mt-6 max-w-4xl">{t("pathsTitle")}</h2>
        </SectionReveal>

        <ul className="border-t border-border">
          {[
            {
              who: t("path1Who"),
              name: t("path1Name"),
              what: t("path1What"),
              action: t("path1Action"),
              href: "/request-a-quote" as const,
            },
            {
              who: t("path2Who"),
              name: t("path2Name"),
              what: t("path2What"),
              action: t("path2Action"),
              href: "/green-coffee-offer-list" as const,
            },
          ].map((path) => (
            <li
              key={path.name}
              className="group border-b border-border transition-colors hover:bg-page"
            >
              <div className="site-container grid gap-7 py-11 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 lg:py-14">
                <div>
                  <p className="eyebrow">{path.who}</p>
                  <h3 className="display-lg mt-5">{path.name}</h3>
                  <p className="mt-5 max-w-[62ch] text-base leading-7 text-muted-foreground">
                    {path.what}
                  </p>
                </div>
                <Link
                  href={path.href}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-primary px-6 py-3 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  {path.action}
                  <ArrowUpRight
                    className="size-4 rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </li>
          ))}

          <li className="border-b border-border bg-primary text-primary-foreground">
            <div className="site-container grid gap-7 py-11 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 lg:py-14">
              <div>
                <p className="flex items-center gap-2.5">
                  <Lock
                    className="size-3.5 text-gold-contrast"
                    aria-hidden="true"
                  />
                  <span className="eyebrow !text-gold-contrast">
                    {t("path3Badge")}
                  </span>
                </p>
                <h3 className="display-lg mt-5">{t("path3Name")}</h3>
                <p className="mt-5 max-w-[62ch] text-base leading-7 text-white/72">
                  {t("path3What")}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <Link
                  href="/sign-in"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold px-6 py-3 text-sm font-bold text-[#0b241d] transition-colors hover:bg-gold-bright"
                >
                  {actions("signin")}
                </Link>
                {/*
                 * A business that is not yet approved needs somewhere to go
                 * that already exists. This is the ordinary commercial request
                 * route — no membership workflow, no separate application.
                 */}
                <Link
                  href="/request-a-quote"
                  className="text-sm font-bold text-gold-contrast underline-offset-4 hover:underline"
                >
                  {t("path3Access")}
                </Link>
              </div>
            </div>
          </li>
        </ul>
      </section>

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

      {/*
       * Traceability, evidenced rather than claimed.
       *
       * The list is the actual field set carried by every published lot — read
       * off the catalog data layer, not invented. Altitude, producer name and
       * farm size are deliberately absent: this data model does not hold them,
       * and listing them would be the exact kind of unearned claim the section
       * exists to argue against. The two figures beneath come from data this
       * page has already loaded, so they cost no extra query and are true at
       * render time.
       */}
      <section className="section-space bg-page">
        <div className="site-container grid gap-12 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16">
          <ImageReveal className="relative aspect-[4/5] bg-muted lg:aspect-[3/4]">
            <Image
              src="/images/hills-quality-traceability.webp"
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
      </section>

      <FeaturedCoffeeSection
        offers={catalog.offers}
        media={coffeeHeroMedia}
        title={t("featured")}
        intro={t("featuredBody")}
        empty={t("featuredEmpty")}
        bagsLabel={catalogT("bags")}
        viewLabel={originsT("viewCoffee")}
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
            <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] border-s border-t border-border">
              {homeOrigins.map((origin, index) => {
                /*
                 * Whatever an Administrator set as this origin's hero in the
                 * media picker. Nothing is hardcoded per origin: changing the
                 * hero in Admin changes this image with no code change, and an
                 * origin with no hero simply falls through to the branded
                 * plate below.
                 */
                const picture = originHeroMedia.get(origin.id);
                return (
                  <SectionReveal key={origin.id} delay={index * 0.05}>
                    <Link
                      href={`/coffee-origins/${origin.slug}`}
                      className="group flex h-full flex-col border-e border-b border-border transition-colors hover:bg-card"
                    >
                      {picture ? (
                        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                          <Image
                            src={picture.url}
                            alt={picture.alt}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                          />
                        </div>
                      ) : (
                        <div className="surface-noise flex aspect-[16/10] items-end bg-primary p-5 text-primary-foreground">
                          <Globe2
                            className="size-6 text-gold-bright"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                      <span className="flex flex-1 flex-col p-6">
                        <span className="eyebrow">
                          {publicContinentLabel(
                            origin.continent,
                            locale as Locale,
                          )}
                        </span>
                        <span
                          lang={origin.lang}
                          className="mt-3 block font-heading text-3xl leading-tight font-bold"
                        >
                          {origin.name}
                        </span>
                      </span>
                    </Link>
                  </SectionReveal>
                );
              })}
            </div>
          ) : (
            <p className="empty-state mt-8">{t("originsEmpty")}</p>
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
          {/* Not "Trade with Hills" any more: that name now belongs to the
              gated buyer path above, and two sections carrying it read as the
              same thing said twice. This band is about how the business runs. */}
          <p className="eyebrow">{t("tradeEyebrowWorking")}</p>
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

          {/*
           * The traceability and access panels that used to sit here have
           * moved rather than been dropped: traceability is now its own
           * evidenced section above, and "public catalogue, protected pricing"
           * is carried by the gated third buyer path, which shows the
           * distinction instead of describing it.
           */}

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
              {actions("requestOffer")}
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
            <p className="empty-state mt-8">{t("knowledgeEmpty")}</p>
          )}
        </div>
      </section>
    </>
  );
}
