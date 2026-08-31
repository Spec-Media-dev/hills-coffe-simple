import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import {
  FeaturedCoffeeSection,
  WarehouseSection,
} from "@/components/content/entity-sections";
import { getOfferList } from "@/lib/data/catalog";
import {
  getSitePage,
  getSiteSettings,
  getWarehouses,
} from "@/lib/data/site-content";
import type { Locale } from "@/i18n/routing";
import {
  cmsMetadata,
  localizedMetadata,
  localizedUrl,
} from "@/lib/seo/metadata";
import { organizationAndWebsiteJsonLd } from "@/lib/seo/organization";

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
  const [page, catalog, warehouses, settings] = await Promise.all([
    getSitePage("home", locale as Locale),
    getOfferList(locale as Locale),
    getWarehouses(locale as Locale),
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
      {page ? (
        <CmsPageView page={page} />
      ) : (
        <section className="section-space bg-primary text-primary-foreground">
          <div className="site-container">
            <p className="eyebrow !text-gold-contrast">Hills Coffee</p>
            <h1 className="display-xl mt-6 max-w-5xl">{t("title")}</h1>
            <p className="mt-8 max-w-2xl text-lg text-white/70">{t("intro")}</p>
          </div>
        </section>
      )}
      <FeaturedCoffeeSection offers={catalog.offers} title={t("featured")} />
      <WarehouseSection
        warehouses={warehouses}
        title={t("network")}
        intro={t("networkBody")}
      />
    </>
  );
}
