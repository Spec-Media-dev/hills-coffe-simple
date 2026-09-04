import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, MapPin, Package, Sprout } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FavoriteButton } from "@/components/catalog/favorite-button";
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
    viewer?.emailVerified
      ? await getProtectedPriceTiers(coffee.offers.map((item) => item.id))
      : new Map();
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
                    <Detail
                      icon={MapPin}
                      label={t("origin")}
                      value={coffee.origin}
                    />
                    <Detail
                      icon={Sprout}
                      label={t("process")}
                      value={coffee.process}
                    />
                    <Detail
                      icon={Package}
                      label={t("score")}
                      value={coffee.cupScore}
                    />
                    <Detail
                      icon={Package}
                      label={t("sensory")}
                      value={coffee.certifications.join(", ") || "—"}
                    />
                  </dl>
                </div>
              </div>
            </ImageReveal>
          </div>
        </div>
      </section>
      <section className="section-space">
        <SectionReveal className="site-container">
          <p className="eyebrow">{t("offers")}</p>
          <h2 className="display-lg mt-5">{t("offers")}</h2>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            {t("offersBody")}
          </p>
          <div className="mt-10 overflow-hidden border border-border bg-card">
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
                    prices.get(offer.id)?.map((tier) => (
                      <p
                        key={tier.minBags}
                        className="text-sm font-bold text-highlight"
                      >
                        {tier.minBags}+ · ${tier.pricePerKgUsd.toFixed(2)}/kg
                      </p>
                    ))
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
