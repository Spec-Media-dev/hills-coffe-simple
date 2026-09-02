import Image from "next/image";
import type { Metadata } from "next";
import { Eye, Handshake, Scale } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";
import type { Locale } from "@/i18n/routing";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata, localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const page = await getSitePage("about", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/about");
  const t = await getTranslations({ locale, namespace: "about" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/about",
    title: t("title"),
    description: t("intro"),
  });
}

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [page, t] = await Promise.all([
    getSitePage("about", locale as Locale),
    getTranslations("about"),
  ]);
  if (page) return <CmsPageView page={page} />;
  const principles = [
    { icon: Eye, title: t("one"), body: t("oneBody") },
    { icon: Scale, title: t("two"), body: t("twoBody") },
    { icon: Handshake, title: t("three"), body: t("threeBody") },
  ];
  return (
    <>
      <section className="section-space bg-page">
        <SectionReveal className="site-container grid gap-10 lg:grid-cols-[1fr_.6fr] lg:items-end">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="display-hero mt-7 max-w-6xl">{t("title")}</h1>
          </div>
          <p className="max-w-xl border-s border-border ps-7 text-lg leading-8 text-muted-foreground">
            {t("intro")}
          </p>
        </SectionReveal>
      </section>
      <section className="overflow-hidden bg-primary text-primary-foreground">
        <div className="site-container grid lg:grid-cols-[1.1fr_.9fr]">
          <ImageReveal className="relative min-h-[32rem] lg:-ms-12 lg:min-h-[44rem]">
            <Image
              src="/images/farmer-partnership.jpg"
              alt=""
              fill
              priority
              sizes="(min-width:1024px) 55vw, 100vw"
              className="object-cover"
            />
          </ImageReveal>
          <SectionReveal className="flex flex-col justify-center py-16 lg:px-16">
            <p className="eyebrow !text-gold-contrast">{t("principles")}</p>
            <h2 className="display-lg mt-6">{t("three")}</h2>
            <p className="mt-7 text-lg leading-8 text-white/68">
              {t("threeBody")}
            </p>
          </SectionReveal>
        </div>
      </section>
      <section className="section-space">
        <div className="site-container">
          <p className="eyebrow">{t("principles")}</p>
          <div className="mt-10 grid border-s border-t border-border lg:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }, index) => (
              <SectionReveal
                key={title}
                delay={index * 0.05}
                className="h-full"
              >
                <article className="min-h-80 border-e border-b border-border bg-card p-8">
                  <Icon className="size-7 text-highlight" aria-hidden="true" />
                  <p className="mt-16 text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 text-3xl">{title}</h2>
                  <p className="mt-5 leading-7 text-muted-foreground">{body}</p>
                </article>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
