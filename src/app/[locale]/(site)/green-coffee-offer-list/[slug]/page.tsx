import type { Metadata } from "next";
import { ArrowLeft, MapPin, Package, Sprout } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { InquiryPanel } from "@/components/inquiries/inquiry-panel";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import { getCoffeeBySlug } from "@/lib/data/catalog";
import { getProtectedPriceTiers } from "@/lib/data/pricing";
import { localizedMetadata, localizedUrl } from "@/lib/seo/metadata";
import { toggleFavoriteAction } from "@/actions/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const t = await getTranslations("product");
  const actions = await getTranslations("actions");
  const catalog = await getTranslations("catalog");
  const viewer = await getViewer();
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
  const inquiryLabels =
    locale === "ar"
      ? {
          inquire: "إرسال طلب",
          sample: "طلب عينة",
          signin: actions("signin"),
          message: "تفاصيل الطلب",
          send: "إرسال الطلب",
          title: "اسأل عن هذا العرض",
          body: "يتم التحقق من سياق العرض على الخادم",
          sampleTitle: "اطلب عينة للمراجعة",
          sampleBody: "طلب للمراجعة اليدوية ولا يضمن إرسال عينة",
          sampleSend: "إرسال طلب العينة",
          verify: "تأكيد البريد للمتابعة",
          close: "إغلاق",
        }
      : {
          inquire: "Send request",
          sample: "Request sample",
          signin: actions("signin"),
          message: "Request details",
          send: "Send request",
          title: "Ask about this offer",
          body: "Offer context is verified on the server",
          sampleTitle: "Request a sample for review",
          sampleBody:
            "Manual business review only; submission does not guarantee a physical sample",
          sampleSend: "Submit sample request",
          verify: "Verify email to continue",
          close: "Close",
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
          <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
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
                <form action={toggleFavoriteAction} className="mt-7">
                  <input
                    type="hidden"
                    name="coffeeId"
                    value={coffee.coffeeId}
                  />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/${locale}/green-coffee-offer-list/${slug}`}
                  />
                  <button className="rounded-full border border-border bg-card px-5 py-3 text-sm font-bold">
                    {favorite
                      ? locale === "ar"
                        ? "إزالة من المفضلة"
                        : "Remove from favourites"
                      : locale === "ar"
                        ? "حفظ في المفضلة"
                        : "Save to favourites"}
                  </button>
                </form>
              ) : null}
            </div>
            <div className="rounded-[2rem] bg-primary p-8 text-primary-foreground">
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
        </div>
      </section>
      <section className="section-space">
        <div className="site-container">
          <p className="eyebrow">{t("offers")}</p>
          <h2 className="display-lg mt-5">{t("offers")}</h2>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            {t("offersBody")}
          </p>
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
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
                  {offer.bags} {catalog("bags")} · {offer.status}
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
                      {actions("pricing")}
                    </p>
                  )}
                </div>
                <InquiryPanel
                  offerId={offer.id}
                  coffeeName={coffee.name}
                  warehouse={offer.warehouse}
                  signedIn={Boolean(viewer)}
                  verifiedEmail={Boolean(viewer?.emailVerified)}
                  locale={locale as Locale}
                  labels={inquiryLabels}
                />
              </article>
            ))}
          </div>
        </div>
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
