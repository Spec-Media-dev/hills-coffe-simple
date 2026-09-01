import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOrigins } from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/coffee-origins">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/coffee-origins",
    title: meta("originsTitle"),
    description:
      locale === "ar"
        ? "استكشف سياق الزراعة والمعالجة والتوريد لمناشئ القهوة المنشورة."
        : "Explore the cultivation, processing, and sourcing context of published coffee origins.",
  });
}

export default async function OriginsPage({
  params,
}: PageProps<"/[locale]/coffee-origins">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const originsT = await getTranslations("origins");
  const origins = await getOrigins(locale as Locale);
  const text =
    locale === "ar"
      ? {
          eyebrow: "مناشئ القهوة",
          title: "أماكن تشكل طعم القهوة.",
          intro: "استكشف سياق الزراعة والمعالجة والتوريد لكل منشأ.",
          empty: "لا توجد مناشئ منشورة حالياً.",
        }
      : {
          eyebrow: "Coffee origins",
          title: "Places that shape the cup.",
          intro:
            "Explore the cultivation, processing, and sourcing context behind each origin.",
          empty: "No origins are published yet.",
        };
  return (
    <>
      <section className="section-space bg-primary text-primary-foreground">
        <div className="site-container">
          <p className="eyebrow !text-gold-contrast">{text.eyebrow}</p>
          <h1 className="display-xl mt-6 max-w-5xl">{text.title}</h1>
          <p className="mt-7 max-w-2xl text-lg text-white/70">{text.intro}</p>
        </div>
      </section>
      <section className="section-space">
        <div className="site-container">
          {origins.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {origins.map((origin) => (
                <Link
                  key={origin.id}
                  href={`/coffee-origins/${origin.slug}`}
                  className="group rounded-[1.5rem] border border-border bg-card p-7 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-highlight"
                >
                  <MapPin className="size-6 text-highlight" />
                  <h2 lang={origin.lang} className="mt-14 text-4xl">
                    {origin.name}
                  </h2>
                  {origin.summary ? (
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {origin.summary}
                    </p>
                  ) : null}
                  {/* Aggregated in one query for all origins, not one per card. */}
                  <p className="mt-5 text-xs font-bold text-highlight">
                    {originsT("coffeeCount", { count: origin.coffeeCount })}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {text.empty}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
