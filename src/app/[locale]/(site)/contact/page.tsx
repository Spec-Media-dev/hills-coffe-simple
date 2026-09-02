import type { Metadata } from "next";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { WarehouseSection } from "@/components/content/entity-sections";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getSitePage,
  getSiteSettings,
  getWarehouses,
} from "@/lib/data/site-content";
import { cmsMetadata, localizedMetadata } from "@/lib/seo/metadata";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const page = await getSitePage("contact", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/contact");
  const meta = await getTranslations({ locale, namespace: "contact" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/contact",
    title: meta("metaTitle"),
    description: meta("metaDescription"),
  });
}

export default async function ContactPage({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const actions = await getTranslations("actions");
  const [page, settings, warehouses] = await Promise.all([
    getSitePage("contact", locale as Locale),
    getSiteSettings(locale as Locale),
    getWarehouses(locale as Locale),
  ]);
  return (
    <>
      {page ? (
        <CmsPageView page={page} />
      ) : (
        <section className="section-space bg-page">
          <SectionReveal className="site-container grid gap-8 md:grid-cols-[1fr_.55fr] md:items-end">
            <div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="display-xl mt-6 max-w-5xl">{t("title")}</h1>
            </div>
            <p className="mt-7 max-w-2xl text-lg text-muted-foreground">
              {t("intro")}
            </p>
          </SectionReveal>
        </section>
      )}
      <section className="pb-24">
        <div className="site-container grid gap-px overflow-hidden bg-border lg:grid-cols-[1fr_.8fr_.8fr]">
          <SectionReveal className="bg-card p-7 md:p-10">
            <h2 className="text-3xl">{t("details")}</h2>
            <div className="mt-7 grid gap-5 text-sm">
              {!settings?.org_email &&
              !settings?.org_phone &&
              !settings?.address ? (
                <p className="text-muted-foreground">{t("detailsEmpty")}</p>
              ) : null}
              {settings?.org_email ? (
                <a
                  className="flex items-center gap-3"
                  href={`mailto:${settings.org_email}`}
                >
                  <Mail className="size-5 text-highlight" />
                  {settings.org_email}
                </a>
              ) : null}
              {settings?.org_phone ? (
                <a
                  className="flex items-center gap-3"
                  href={`tel:${settings.org_phone}`}
                >
                  <Phone className="size-5 text-highlight" />
                  {settings.org_phone}
                </a>
              ) : null}
              {settings?.address ? (
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-highlight" />
                  {settings.address}
                </p>
              ) : null}
            </div>
          </SectionReveal>
          <SectionReveal className="bg-primary p-7 text-primary-foreground md:p-10">
            <p className="text-xl leading-8">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-in"
                className="rounded-full bg-highlight px-6 py-3 text-sm font-bold text-white"
              >
                {actions("signin")}
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-bold"
              >
                {actions("inquire")}
              </Link>
            </div>
          </SectionReveal>
          <ImageReveal className="relative min-h-[22rem] bg-muted">
            <Image
              src="/images/warehouse-bags.jpg"
              alt=""
              fill
              sizes="(min-width:1024px) 30vw, 100vw"
              className="object-cover"
            />
          </ImageReveal>
        </div>
      </section>
      <WarehouseSection
        warehouses={warehouses}
        title={t("details")}
        intro={t("eyebrow")}
        empty={t("warehousesEmpty")}
      />
    </>
  );
}
