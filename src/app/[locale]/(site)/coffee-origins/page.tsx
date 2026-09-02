import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOrigins } from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";
import { SectionReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/coffee-origins">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/coffee-origins",
    title: meta("originsTitle"),
    description: meta("originsDescription"),
  });
}

export default async function OriginsPage({
  params,
}: PageProps<"/[locale]/coffee-origins">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const originsT = await getTranslations("origins");
  const origins = await getOrigins(locale as Locale);
  return (
    <>
      <section className="section-space overflow-hidden bg-page">
        <SectionReveal className="site-container text-center">
          <p className="eyebrow">{originsT("eyebrow")}</p>
          <h1 className="display-hero mx-auto mt-7 max-w-6xl">{originsT("title")}</h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground">
            {originsT("intro")}
          </p>
          <div
            aria-hidden="true"
            className="origin-map-field mx-auto mt-16 aspect-[2/1] w-full max-w-6xl border border-border"
          />
        </SectionReveal>
      </section>
      <section className="section-space">
        <div className="site-container">
          {origins.length ? (
            <div className="grid border-s border-t border-border md:grid-cols-2 xl:grid-cols-3">
              {origins.map((origin, index) => (
                <Link
                  key={origin.id}
                  href={`/coffee-origins/${origin.slug}`}
                  className="group min-h-80 border-e border-b border-border bg-card p-7 transition-colors hover:bg-page"
                >
                  <div className="flex items-center justify-between">
                    <MapPin className="size-6 text-highlight" />
                    <span className="text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 lang={origin.lang} className="mt-20 text-4xl">
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
              {originsT("empty")}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
