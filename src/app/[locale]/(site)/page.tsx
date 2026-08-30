import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  Globe2,
  Leaf,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { CoffeePreview } from "@/components/catalog/coffee-preview";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import { catalogForViewer } from "@/lib/catalog";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("home");
  const actions = await getTranslations("actions");
  const viewer = await getViewer();
  const featured = catalogForViewer(viewer)
    .filter((coffee) => coffee.category === "specialty")
    .slice(0, 3);

  return (
    <>
      <section className="relative min-h-[calc(100svh-72px)] overflow-hidden bg-[#102219] text-white">
        <Image
          src="/images/hills-hero.png"
          alt="Green coffee quality professional inspecting fresh beans"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,27,18,.92)_0%,rgba(9,27,18,.62)_40%,rgba(9,27,18,.1)_78%)] rtl:bg-[linear-gradient(270deg,rgba(9,27,18,.92)_0%,rgba(9,27,18,.62)_40%,rgba(9,27,18,.1)_78%)]" />
        <div className="surface-noise site-container relative flex min-h-[calc(100svh-72px)] flex-col justify-end pb-10 pt-28 md:pb-14">
          <Reveal className="max-w-4xl">
            <p className="eyebrow !text-[#E8A84E]">{t("eyebrow")}</p>
            <h1 className="display-xl mt-6 max-w-4xl">{t("title")}</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/75 md:text-lg">
              {t("intro")}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-12 items-center gap-3 rounded-full bg-gold px-6 text-sm font-bold text-[#17251c] transition hover:bg-gold-bright"
              >
                {actions("explore")}
                <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 text-sm font-bold transition hover:border-white hover:bg-white/10"
              >
                {actions("inquire")}
              </Link>
            </div>
          </Reveal>
          <div className="mt-16 flex items-end justify-between border-t border-white/20 pt-5 text-xs text-white/60">
            <span>
              {locale === "ar"
                ? "مصر · دبي · منذ 2016"
                : "Egypt · Dubai · Est. 2016"}
            </span>
            <a
              href="#featured"
              className="flex items-center gap-2 uppercase tracking-[.15em]"
            >
              {locale === "ar" ? "تابع" : "Scroll"}{" "}
              <ArrowDown className="size-4 animate-bounce" />
            </a>
          </div>
        </div>
      </section>

      <section id="featured" className="section-space bg-page">
        <div className="site-container">
          <Reveal className="grid gap-7 md:grid-cols-[.8fr_1.2fr] md:items-end">
            <div>
              <p className="eyebrow">{t("featured")}</p>
              <h2 className="display-lg mt-5">
                {locale === "ar"
                  ? "قهوة لها وجهة نظر واضحة."
                  : "Coffee with a clear point of view."}
              </h2>
            </div>
            <p className="max-w-lg text-base leading-7 text-muted-foreground md:justify-self-end">
              {t("featuredBody")}
            </p>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
            {featured.map((coffee) => (
              <StaggerItem key={coffee.id}>
                <CoffeePreview
                  coffee={coffee}
                  locale={locale}
                  viewLabel={actions("view")}
                />
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-9 flex justify-end">
            <Link
              href="/products"
              className="group inline-flex items-center gap-3 border-b border-foreground pb-1 text-sm font-bold"
            >
              {actions("explore")}
              <ArrowUpRight className="size-4 transition group-hover:-translate-y-1 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="section-space overflow-hidden bg-background">
        <div className="site-container">
          <Reveal className="max-w-3xl">
            <p className="eyebrow">
              {locale === "ar" ? "توريد محلي" : "Local supply"}
            </p>
            <h2 className="display-lg mt-5">{t("network")}</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              {t("networkBody")}
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <article className="group relative min-h-[520px] overflow-hidden rounded-2xl">
                <Image
                  src="/images/warehouse-egypt.png"
                  alt="Hills Coffee warehouse in Egypt"
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover transition duration-1000 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7 text-white md:p-9">
                  <div className="mb-5 flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/20 backdrop-blur">
                    <MapPin className="size-5 text-gold-bright" />
                  </div>
                  <h3 className="text-4xl">{t("egypt")}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/72">
                    {t("egyptBody")}
                  </p>
                  <Link
                    href="/products?location=Egypt"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold-bright"
                  >
                    {actions("explore")}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="group relative min-h-[520px] overflow-hidden rounded-2xl">
                <Image
                  src="/images/warehouse-dubai.png"
                  alt="Hills Coffee warehouse in Dubai"
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover transition duration-1000 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7 text-white md:p-9">
                  <div className="mb-5 flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/20 backdrop-blur">
                    <MapPin className="size-5 text-gold-bright" />
                  </div>
                  <h3 className="text-4xl">{t("dubai")}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/72">
                    {t("dubaiBody")}
                  </p>
                  <Link
                    href="/products?location=Dubai"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold-bright"
                  >
                    {actions("explore")}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section-space bg-primary text-primary-foreground">
        <div className="site-container grid gap-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <Reveal>
            <p className="eyebrow !text-gold-contrast">
              {locale === "ar" ? "نهجنا" : "Our approach"}
            </p>
            <h2 className="display-lg mt-5 max-w-3xl">{t("story")}</h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/68">
              {t("storyBody")}
            </p>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-2 border-b border-gold-bright pb-1 text-sm font-bold text-gold-bright"
            >
              {actions("learn")}
              <ArrowUpRight className="size-4" />
            </Link>
          </Reveal>
          <Stagger className="grid gap-px overflow-hidden rounded-2xl bg-white/12 sm:grid-cols-3 lg:grid-cols-1">
            <StaggerItem className="flex gap-4 bg-white/[.04] p-6">
              <Globe2 className="size-6 shrink-0 text-gold-bright" />
              <div>
                <h3 className="font-sans text-base font-bold">
                  {locale === "ar" ? "وصول عالمي" : "Global reach"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {locale === "ar"
                    ? "معرفة بالمنشأ متصلة بتوريد إقليمي عملي."
                    : "Origin insight connected to practical regional supply."}
                </p>
              </div>
            </StaggerItem>
            <StaggerItem className="flex gap-4 bg-white/[.04] p-6">
              <ShieldCheck className="size-6 shrink-0 text-gold-bright" />
              <div>
                <h3 className="font-sans text-base font-bold">
                  {locale === "ar" ? "وضوح مفيد" : "Useful clarity"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {locale === "ar"
                    ? "مواصفات وتوفر يمكن لفريقك البناء عليهما."
                    : "Specifications and availability your team can act on."}
                </p>
              </div>
            </StaggerItem>
            <StaggerItem className="flex gap-4 bg-white/[.04] p-6">
              <Leaf className="size-6 shrink-0 text-gold-bright" />
              <div>
                <h3 className="font-sans text-base font-bold">
                  {locale === "ar" ? "قيمة مستدامة" : "Durable value"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {locale === "ar"
                    ? "قرارات تصنع علاقات تتجاوز محصولاً واحداً."
                    : "Decisions made for relationships that last beyond one lot."}
                </p>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      <section className="section-space bg-page">
        <div className="site-container">
          <Reveal className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-soft)] md:px-14 md:py-24">
            <div className="absolute inset-y-0 start-0 w-1.5 bg-gold" />
            <p className="eyebrow">
              {locale === "ar" ? "خطوة تالية أفضل" : "A better next step"}
            </p>
            <h2 className="display-lg mx-auto mt-5 max-w-4xl">{t("cta")}</h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              {t("ctaBody")}
            </p>
            <Link
              href="/contact"
              className="mt-9 inline-flex h-12 items-center gap-3 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
            >
              {actions("inquire")}
              <ArrowUpRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
