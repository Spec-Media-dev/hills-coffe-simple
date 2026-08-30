import type { Metadata } from "next";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  MapPin,
  Mountain,
  Package,
  Sprout,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CoffeePreview } from "@/components/catalog/coffee-preview";
import { InquiryPanel } from "@/components/inquiries/inquiry-panel";
import { Reveal } from "@/components/motion/reveal";
import { coffees, getCoffeeBySlug } from "@/data/coffees";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth/session";
import { catalogForViewer } from "@/lib/catalog";

export function generateStaticParams() {
  return coffees.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  const coffee = getCoffeeBySlug(slug);
  if (!coffee) return {};
  return {
    title: coffee.name[locale as Locale],
    description: coffee.cupNote[locale as Locale],
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/[locale]/products/[slug]">) {
  const { slug, locale } = (await params) as { slug: string; locale: Locale };
  const base = getCoffeeBySlug(slug);
  if (!base) notFound();
  const t = await getTranslations("product");
  const actions = await getTranslations("actions");
  const viewer = await getViewer();
  const catalog = catalogForViewer(viewer);
  const coffee = catalog.find((item) => item.slug === slug)!;
  const related = catalog
    .filter(
      (item) =>
        item.id !== coffee.id &&
        (item.origin === coffee.origin || item.category === coffee.category),
    )
    .slice(0, 2);
  const inquiryLabels = {
    inquire: actions("inquire"),
    signin: actions("signin"),
    quantity: locale === "ar" ? "عدد الأكياس" : "Bags requested",
    message: locale === "ar" ? "تفاصيل الطلب" : "Inquiry details",
    send: locale === "ar" ? "إرسال الطلب" : "Send inquiry",
    title: locale === "ar" ? "طلب عرض" : "Ask about this offer",
    body:
      locale === "ar"
        ? "سيتم اشتقاق سياق العرض بأمان على الخادم"
        : "offer context is verified securely on the server",
  };
  return (
    <>
      <section className="overflow-hidden border-b border-border bg-page">
        <div className="site-container py-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-gold"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("back")}
          </Link>
          <div className="grid gap-10 pb-16 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
            <Reveal>
              <p className="eyebrow">
                {coffee.origin} · {coffee.category}
              </p>
              <h1 className="display-xl mt-6 max-w-3xl">
                {coffee.name[locale]}
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
                {coffee.cupNote[locale]}
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {coffee.sensory.map((note) => (
                  <span
                    key={note.en}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
                  >
                    {note[locale]}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal
              delay={0.08}
              className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-primary p-8 text-white shadow-[var(--shadow-soft)]"
            >
              <div
                className="absolute -end-16 -top-14 size-72 rounded-full opacity-70 blur-3xl"
                style={{ background: coffee.color }}
              />
              <div className="absolute -bottom-36 -start-24 size-80 rounded-full border-[70px] border-white/5" />
              <div className="relative flex h-full min-h-[354px] flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold uppercase tracking-[.18em] text-white/55">
                    Hills selection / {coffee.offers[0].cropYear}
                  </span>
                  {coffee.score && (
                    <span className="grid size-16 place-items-center rounded-full border border-white/20 bg-black/10 font-heading text-2xl backdrop-blur">
                      {coffee.score}
                    </span>
                  )}
                </div>
                <div>
                  <p className="max-w-sm font-heading text-3xl leading-tight">
                    {coffee.sensory.map((x) => x[locale]).join(" · ")}
                  </p>
                  <p className="mt-4 text-sm text-white/55">
                    {coffee.region[locale]} · {coffee.elevation}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
      <section className="section-space bg-background">
        <div className="site-container grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <p className="eyebrow">{t("identity")}</p>
            <h2 className="display-lg mt-5">
              {locale === "ar"
                ? "التفاصيل خلف الكوب."
                : "The detail behind the cup."}
            </h2>
          </Reveal>
          <Reveal
            delay={0.08}
            className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2"
          >
            {[
              [MapPin, t("region"), coffee.region[locale]],
              [Sprout, t("producer"), coffee.producer[locale]],
              [Award, t("variety"), coffee.varieties.join(", ")],
              [Package, t("process"), coffee.process],
              [Mountain, t("elevation"), coffee.elevation],
              [CalendarDays, t("harvest"), coffee.offers[0].cropYear],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof MapPin;
              return (
                <div key={String(label)} className="bg-card p-6">
                  <I className="size-5 text-gold" />
                  <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {String(label)}
                  </p>
                  <p className="mt-2 font-medium">{String(value)}</p>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>
      <section className="section-space bg-page">
        <div className="site-container">
          <Reveal className="max-w-3xl">
            <p className="eyebrow">{t("offers")}</p>
            <h2 className="display-lg mt-5">
              {locale === "ar"
                ? "المتاح، مخزناً بعد مخزن."
                : "Available, warehouse by warehouse."}
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              {t("offersBody")}
            </p>
          </Reveal>
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
            {coffee.offers.map((offer) => (
              <div
                key={offer.id}
                className="grid gap-5 border-b border-border p-5 last:border-0 md:grid-cols-[1.1fr_.8fr_.8fr_1fr_auto] md:items-center md:p-6"
              >
                <div>
                  <p className="flex items-center gap-2 font-bold">
                    <MapPin className="size-4 text-gold" />
                    {offer.warehouse}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.reference}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("packaging")}
                  </p>
                  <p className="mt-1 text-sm">
                    {offer.bagWeightKg} kg · {offer.packaging}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("status")}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {locale === "ar"
                      ? (
                          {
                            Available: "متاح",
                            Limited: "كمية محدودة",
                            "Coming soon": "قريباً",
                          } as const
                        )[offer.status]
                      : offer.status}{" "}
                    · {offer.bagsAvailable} {locale === "ar" ? "كيس" : "bags"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("price")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-gold">
                    {offer.price ?? actions("pricing")}
                  </p>
                </div>
                <InquiryPanel
                  offerId={offer.id}
                  coffeeName={coffee.name[locale]}
                  warehouse={offer.warehouse}
                  signedIn={Boolean(viewer)}
                  labels={inquiryLabels}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-space bg-background">
        <div className="site-container grid gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">{t("editorial")}</p>
            <h2 className="display-lg mt-5">
              {coffee.sensory[0][locale]}
              {locale === "ar" ? "، ثم الوضوح." : ", then clarity."}
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-xl leading-9 text-muted-foreground">
              {coffee.story[locale]}
            </p>
            <div className="mt-10 border-s-2 border-gold ps-6">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {locale === "ar"
                  ? "نقطة بداية مقترحة"
                  : "Recommended starting point"}
              </p>
              <p className="mt-3 leading-7">
                {locale === "ar"
                  ? "تحميصة فلتر بتطوير مدروس، أو إسبريسو عصري مشرق يحافظ على بنية المحصول."
                  : "Filter roast with a measured development window, or a bright modern espresso that protects the coffee’s structure."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>
      {related.length > 0 && (
        <section className="section-space border-t border-border bg-page">
          <div className="site-container">
            <p className="eyebrow">{t("related")}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {related.map((item) => (
                <CoffeePreview
                  key={item.id}
                  coffee={item}
                  locale={locale}
                  viewLabel={actions("view")}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
