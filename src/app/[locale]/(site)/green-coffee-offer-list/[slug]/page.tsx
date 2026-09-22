import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, MapPin, Package, Sprout, Tag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { OfferPriceDisclosure } from "@/components/catalog/offer-price-disclosure";
import { InquiryPanel } from "@/components/inquiries/inquiry-panel";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import { getPublicPersona } from "@/lib/auth/persona";
import { getActiveSampleRequestForCoffee } from "@/lib/data/inquiries";
import { getCoffeeBySlug, getPublicCoffeeMedia } from "@/lib/data/catalog";
import { getProtectedPriceTiers } from "@/lib/data/pricing";
import { localizedMetadata, localizedUrl } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";
import { publicOfferStatusKey } from "@/lib/public-labels";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/green-coffee-offer-list/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const coffee = await getCoffeeBySlug(slug, locale as Locale);
  return coffee
    ? localizedMetadata({
        locale: locale as Locale,
        path: `/green-coffee-offer-list/${slug}`,
        paths: {
          en: coffee.availableLocales.includes("en")
            ? `/green-coffee-offer-list/${slug}`
            : undefined,
          ar: coffee.availableLocales.includes("ar")
            ? `/green-coffee-offer-list/${slug}`
            : undefined,
        },
        title: coffee.name,
        description:
          [coffee.origin, coffee.region, coffee.process]
            .filter(Boolean)
            .join(" · ") || undefined,
      })
    : {};
}

export default async function CoffeePage({
  params,
}: PageProps<"/[locale]/green-coffee-offer-list/[slug]">) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const coffee = await getCoffeeBySlug(slug, locale as Locale);
  if (!coffee) notFound();
  const coffeeMedia = await getPublicCoffeeMedia(
    coffee.coffeeId,
    locale as Locale,
  );
  const mainMedia =
    coffeeMedia.find((item) => item.role === "MAIN") ?? coffeeMedia[0] ?? null;
  const t = await getTranslations("product");
  const actions = await getTranslations("actions");
  const catalog = await getTranslations("catalog");
  const inquiry = await getTranslations("inquiry");
  const publicInquiry = await getTranslations("publicInquiry");
  const requests = await getTranslations("account.requests");
  const viewer = await getViewer();
  const persona = await getPublicPersona();
  /*
   * Asked before the buttons render, so a customer who already holds an active
   * sample request for this coffee is shown that state instead of an action
   * the server would refuse. Returns null for anyone not entitled to create
   * one, so "none" and "not entitled" are indistinguishable here.
   */
  const activeSample = await getActiveSampleRequestForCoffee(coffee.coffeeId);
  /** What to say when this offer has no protected tier for this reader. */
  const noPriceLabel =
    persona === "verified"
      ? catalog("pricingOnRequest")
      : persona === "unverified"
        ? catalog("pricingVerifyTitle")
        : persona === "blocked"
          ? catalog("pricingBlockedTitle")
          : persona === "admin"
            ? catalog("pricingOnRequest")
            : actions("pricing");
  const prices: Map<string, { minBags: number; pricePerKgUsd: number }[]> =
    await getProtectedPriceTiers(coffee.offers.map((item) => item.id));
  const favorite = viewer
    ? (
        await (
          await createSupabaseServerClient()
        )
          .from("favorites")
          .select("coffee_id")
          .eq("user_id", viewer.id)
          .eq("coffee_id", coffee.coffeeId)
          .maybeSingle()
      ).data
    : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: coffee.name,
    category: "Green coffee",
    countryOfOrigin: coffee.origin,
    url: localizedUrl(locale as Locale, `/green-coffee-offer-list/${slug}`),
  };
  // Every string here comes from the catalogue. A `locale === "ar"` table
  // used to live in this file, which is precisely how a label gets added in
  // one language only; the EN/AR parity test now covers these keys.
  const inquiryLabels = {
    inquire: inquiry("inquire"),
    sample: inquiry("sample"),
    signin: actions("signin"),
    message: inquiry("message"),
    send: inquiry("send"),
    title: inquiry("title"),
    body: inquiry("body"),
    sampleTitle: inquiry("sampleTitle"),
    sampleBody: inquiry("sampleBody"),
    sampleSend: inquiry("sampleSend"),
    activeSample: inquiry("activeSample"),
    viewRequest: requests("viewRequest"),
    verify: inquiry("verify"),
    close: inquiry("close"),
    // The anonymous sample dialog's own heading/description, kept in the
    // public namespace so it reads to a visitor with no account rather than
    // reusing the signed-in dialog's wording.
    publicSampleTitle: publicInquiry("sampleTitle"),
    publicSampleBody: publicInquiry("sampleIntro"),
  };
  const elevation =
    coffee.detail.altitudeMinMeters != null &&
    coffee.detail.altitudeMaxMeters != null
      ? `${coffee.detail.altitudeMinMeters}–${coffee.detail.altitudeMaxMeters} m`
      : coffee.detail.altitudeMinMeters != null
        ? `${coffee.detail.altitudeMinMeters} m`
        : coffee.detail.altitudeMaxMeters != null
          ? `${coffee.detail.altitudeMaxMeters} m`
          : null;
  const harvest = coffee.detail.harvestMonths
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .map((month) =>
      new Intl.DateTimeFormat(locale, { month: "long" }).format(
        new Date(Date.UTC(2024, month - 1, 1)),
      ),
    )
    .join(" · ");
  // Authorized price summaries: computed strictly from real protected tiers
  // returned by `getProtectedPriceTiers`. Anonymous readers receive an empty
  // map from the server, so no protected pricing is ever calculated or rendered.
  const authorizedPriceSummaries = coffee.offers
    .map((offer) => {
      const offerTiers = prices.get(offer.id);
      if (!offerTiers || offerTiers.length === 0) return null;
      const baseTier = offerTiers[0];
      return {
        offerId: offer.id,
        warehouse: offer.warehouse,
        pricePerKgUsd: baseTier.pricePerKgUsd,
        hasMultipleTiers: offerTiers.length > 1,
        minBags: baseTier.minBags,
      };
    })
    .filter(
      (
        item,
      ): item is {
        offerId: string;
        warehouse: string;
        pricePerKgUsd: number;
        hasMultipleTiers: boolean;
        minBags: number;
      } => item !== null,
    );

  const primaryPriceText = authorizedPriceSummaries.length
    ? authorizedPriceSummaries
        .map(
          (s) =>
            `${s.hasMultipleTiers ? t("startingAt", { price: s.pricePerKgUsd.toFixed(2) }) : t("pricePerKg", { price: s.pricePerKgUsd.toFixed(2) })}${coffee.offers.length > 1 ? ` (${s.warehouse})` : ""}`,
        )
        .join(" · ")
    : null;

  const identityDetails: {
    icon: typeof MapPin;
    label: string;
    value: string | number | null;
  }[] = [
    { icon: MapPin, label: t("origin"), value: coffee.origin },
    { icon: Sprout, label: t("process"), value: coffee.process },
    { icon: Package, label: t("score"), value: coffee.cupScore },
    {
      icon: Package,
      label: t("sensory"),
      value: coffee.sensory.length ? coffee.sensory.join(", ") : null,
    },
    ...(primaryPriceText
      ? [{ icon: Tag, label: t("price"), value: primaryPriceText }]
      : []),
  ];
  const visibleIdentityDetails = identityDetails.filter(
    (detail): detail is { icon: typeof MapPin; label: string; value: string | number } =>
      detail.value !== null,
  );
  const totalAvailableBags = coffee.offers.reduce(
    (sum, o) => sum + (Number.isFinite(o.bags) ? o.bags : 0),
    0,
  );
  const coffeeFacts = [
    {
      label: t("producer"),
      value: coffee.detail.ownerProducer ?? coffee.detail.farmCoopStation,
    },
    { label: t("region"), value: coffee.detail.subregionTown ?? coffee.region },
    {
      label: t("variety"),
      value: coffee.detail.varieties.length
        ? coffee.detail.varieties.join(", ")
        : null,
    },
    { label: t("grade"), value: coffee.grade },
    { label: t("elevation"), value: elevation },
    { label: t("harvest"), value: harvest || coffee.availableFrom || null },
    {
      label: t("farmSize"),
      value: coffee.detail.farmSizeHectares
        ? `${coffee.detail.farmSizeHectares} ha`
        : null,
    },
    {
      label: t("reference"),
      value: coffee.reference,
    },
    {
      label: t("totalStock"),
      value: totalAvailableBags > 0 ? `${totalAvailableBags} ${catalog("bags")}` : null,
    },
    {
      label: catalog("certifications"),
      value: coffee.certifications.length ? coffee.certifications.join(", ") : null,
    },
    {
      label: catalog("tags"),
      value: coffee.tags.length ? coffee.tags.join(", ") : null,
    },
  ].filter(
    (fact): fact is { label: string; value: string } => Boolean(fact.value),
  );
  const coffeeStories = [
    { label: t("story"), value: coffee.detail.aboutThisCoffee },
    {
      label: t("cultivation"),
      value: coffee.detail.cultivation,
    },
    {
      label: t("process"),
      value: coffee.detail.processingStory ?? coffee.detail.harvestPostHarvest,
    },
    { label: t("traceability"), value: coffee.detail.traceability },
  ].filter(
    (story): story is { label: string; value: string } => Boolean(story.value),
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="overflow-hidden border-b border-border bg-page">
        <div className="site-container py-10 md:py-20">
          <Breadcrumbs
            locale={locale as Locale}
            items={[
              { label: catalog("title"), href: "/green-coffee-offer-list" },
              { label: coffee.name },
            ]}
          />
          <Link
            href="/green-coffee-offer-list"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("back")}
          </Link>
          <div className="mt-14 grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-stretch">
            <SectionReveal className="flex flex-col justify-end py-4">
              <p className="eyebrow">
                {coffee.origin} · {coffee.type}
              </p>
              <h1 lang={coffee.nameLang} className="display-xl mt-6">
                {coffee.name}
              </h1>
              <p className="mt-7 text-lg text-muted-foreground">
                {[coffee.region, coffee.process, coffee.grade]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {coffee.detail.shortDescription ? (
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {coffee.detail.shortDescription}
                </p>
              ) : null}
              {authorizedPriceSummaries.length ? (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-gold/45 bg-gold/10 px-5 py-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("price")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                      {authorizedPriceSummaries.map((summary) => (
                        <div
                          key={summary.offerId}
                          className="flex items-baseline gap-2"
                        >
                          <span
                            className="font-heading text-2xl font-extrabold text-highlight sm:text-3xl"
                            dir="ltr"
                          >
                            {summary.hasMultipleTiers
                              ? t("startingAt", {
                                  price: summary.pricePerKgUsd.toFixed(2),
                                })
                              : t("pricePerKg", {
                                  price: summary.pricePerKgUsd.toFixed(2),
                                })}
                          </span>
                          {coffee.offers.length > 1 ? (
                            <span className="text-xs font-semibold text-muted-foreground">
                              ({summary.warehouse})
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {coffee.sensory.length ? (
                <div className="mt-8 flex flex-wrap gap-2">
                  {coffee.sensory.map((note) => (
                    <span
                      key={note}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              ) : null}
              {viewer ? (
                <div className="mt-7">
                  <FavoriteButton
                    coffeeId={coffee.coffeeId}
                    returnTo={`/${locale}/green-coffee-offer-list/${slug}`}
                    favorite={Boolean(favorite)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-bold disabled:opacity-60"
                  />
                </div>
              ) : null}
            </SectionReveal>
            <ImageReveal className="relative min-h-[30rem] bg-primary text-primary-foreground">
              {mainMedia ? (
                <Image
                  src={mainMedia.url}
                  alt={mainMedia.alt}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width:1024px) 46vw, 100vw"
                  className="object-cover opacity-72"
                />
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,60,50,.06),rgba(23,60,50,.88))]" />
              <div className="relative flex min-h-[30rem] items-end p-8 md:p-10">
                <div>
                  <p className="eyebrow !text-gold-contrast">{t("identity")}</p>
                  <dl className="mt-8 grid gap-5 sm:grid-cols-2">
                    {visibleIdentityDetails.map((detail) => (
                      <Detail key={detail.label} {...detail} />
                    ))}
                  </dl>
                </div>
              </div>
            </ImageReveal>
          </div>
        </div>
      </section>
      {coffeeFacts.length || coffeeStories.length ? (
        <section className="border-b border-border bg-card/45">
          <SectionReveal className="site-container grid gap-10 py-12 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
            <div>
              <p className="eyebrow">{t("identity")}</p>
              <h2 className="display-lg mt-5">{t("story")}</h2>
              {coffeeFacts.length ? (
                <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {coffeeFacts.map((fact) => (
                    <div key={fact.label} className="border-t border-border pt-3">
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold leading-relaxed">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            {coffeeStories.length ? (
              <div className="grid content-start gap-6">
                {coffeeStories.map((story) => (
                  <article key={story.label} className="border-s-2 border-gold/55 ps-5">
                    <h3 className="font-heading text-xl">{story.label}</h3>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
                      {story.value}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </SectionReveal>
        </section>
      ) : null}
      <section className="section-space">
        <SectionReveal className="site-container">
          <p className="eyebrow">{t("offers")}</p>
          <h2 className="display-lg mt-5">{t("offers")}</h2>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            {t("offersBody")}
          </p>
          <div className="mt-10 overflow-visible border border-border bg-card">
            {coffee.offers.map((offer) => (
              <article
                key={offer.id}
                className="grid gap-5 border-b border-border p-6 last:border-0 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-bold">{offer.warehouse}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.reference}
                  </p>
                </div>
                <p className="text-sm">
                  {offer.bagWeightKg} kg · {offer.packaging}
                </p>
                <p className="text-sm">
                  {offer.bags} {catalog("bags")} ·{" "}
                  {t(publicOfferStatusKey(offer.status))}
                </p>
                <div>
                  {prices.get(offer.id)?.length ? (
                    <OfferPriceDisclosure
                      tiers={prices.get(offer.id) ?? []}
                      labels={{
                        trigger: t("showOffers"),
                        title: t("availableOffers"),
                        close: t("closeOffers"),
                        bags: catalog("bags"),
                        perKg: t("perKg"),
                      }}
                    />
                  ) : (
                    <p className="text-sm font-bold text-highlight">
                      {/*
                       * This fallback used to read "Sign in to view pricing"
                       * for everyone, including a verified customer looking at
                       * an offer that simply has no published tiers, and an
                       * Administrator who is not a customer at all.
                       */}
                      {noPriceLabel}
                    </p>
                  )}
                </div>
                <InquiryPanel
                  offerId={offer.id}
                  coffeeName={coffee.name}
                  warehouse={offer.warehouse}
                  signedIn={Boolean(viewer)}
                  verifiedEmail={Boolean(viewer?.emailVerified)}
                  isCustomer={persona === "verified"}
                  activeSampleRequestCode={activeSample?.requestCode ?? null}
                  labels={inquiryLabels}
                />
              </article>
            ))}
          </div>
        </SectionReveal>
      </section>
    </>
  );
}
function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <Icon className="size-5 text-gold-bright" />
      <dt className="mt-3 text-xs font-bold uppercase tracking-wider text-white/55">
        {label}
      </dt>
      <dd className="mt-1">{value ?? "—"}</dd>
    </div>
  );
}
