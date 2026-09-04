import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOrigins, getPublicOriginHeroMedia } from "@/lib/data/editorial";
import { publicContinentLabel } from "@/lib/public-labels";
import { collectionPageJsonLd, jsonLdScript } from "@/lib/seo/collection";
import { localizedMetadata, localizedUrl } from "@/lib/seo/metadata";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";

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
  // One batched read for the whole page rather than three queries per origin.
  const heroMedia = await getPublicOriginHeroMedia(
    origins.map((origin) => origin.id),
    locale as Locale,
  );

  // Derived from rows already loaded — no extra query, and true at render time.
  const publishedCoffees = origins.reduce(
    (total, origin) => total + origin.coffeeCount,
    0,
  );
  const continents = new Set(
    origins.map((origin) => origin.continent).filter(Boolean),
  ).size;

  /* Mirrors the origin cards this page renders, in the order it renders them. */
  const jsonLd = collectionPageJsonLd({
    locale: locale as Locale,
    canonical: localizedUrl(locale as Locale, "/coffee-origins"),
    name: originsT("title"),
    description: originsT("intro"),
    items: origins.map((origin) => ({
      name: origin.name,
      url: localizedUrl(locale as Locale, `/coffee-origins/${origin.slug}`),
    })),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      {/*
       * The masthead used to end in a half-page `origin-map-field` — an
       * aria-hidden 2:1 rectangle of faint dots carrying no information, which
       * pushed the actual origins a screen and a half down the page. It is
       * replaced by figures drawn from the rows this page already has.
       */}
      <section className="border-b border-border bg-page pt-16 pb-14 md:pt-24 md:pb-16">
        <SectionReveal className="site-container grid gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-16">
          <div>
            <p className="eyebrow">{originsT("eyebrow")}</p>
            <h1 className="display-hero mt-6 max-w-3xl">{originsT("title")}</h1>
            <p className="mt-7 max-w-[54ch] text-lg leading-8 text-muted-foreground">
              {originsT("intro")}
            </p>
          </div>

          {origins.length ? (
            <dl className="grid grid-cols-3 border-t border-border">
              {[
                [origins.length, originsT("statOrigins")],
                [publishedCoffees, originsT("statCoffees")],
                [continents, originsT("statContinents")],
              ].map(([value, label], index) => (
                <div
                  key={label}
                  className={`py-5 ${index ? "border-s border-border ps-5" : "pe-5"}`}
                >
                  <dt className="font-heading text-4xl font-bold tabular-nums">
                    {value}
                  </dt>
                  <dd className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </SectionReveal>
      </section>

      <section className="pt-14 pb-20 md:pt-16 md:pb-28">
        <div className="site-container">
          {origins.length ? (
            /*
             * auto-fit rather than a fixed 3-up: with two published origins a
             * `xl:grid-cols-3` left an empty cell and an orphaned rule down the
             * page. Rows now close up at whatever count exists.
             */
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] border-s border-t border-border">
              {origins.map((origin) => {
                const media = heroMedia.get(origin.id);
                return (
                  <li
                    key={origin.id}
                    className="border-e border-b border-border"
                  >
                    <Link
                      href={`/coffee-origins/${origin.slug}`}
                      className="group flex h-full flex-col bg-card transition-colors hover:bg-page"
                    >
                      {media ? (
                        <ImageReveal className="relative aspect-[3/2] overflow-hidden bg-muted">
                          <Image
                            src={media.url}
                            alt={media.alt}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                          />
                        </ImageReveal>
                      ) : (
                        /*
                         * Not every origin has a published photograph, and an
                         * empty textured rectangle looks like a failure rather
                         * than a choice. A typographic plate keeps the row's
                         * rhythm and still says something true — the continent,
                         * which the card does not otherwise show at scale.
                         */
                        <div className="surface-noise relative flex aspect-[3/2] items-end overflow-hidden bg-primary p-6 text-primary-foreground md:p-7">
                          <span className="font-heading text-3xl leading-tight font-bold text-white/85">
                            {publicContinentLabel(
                              origin.continent,
                              locale as Locale,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-6 md:p-7">
                        {/* Only when the plate is a photograph — otherwise the
                            plate already carries the continent at scale. */}
                        {media ? (
                          <p className="eyebrow">
                            {publicContinentLabel(
                              origin.continent,
                              locale as Locale,
                            )}
                          </p>
                        ) : null}
                        <h2
                          lang={origin.lang}
                          className={`font-heading text-3xl leading-tight font-bold ${media ? "mt-3" : ""}`}
                        >
                          {origin.name}
                        </h2>
                        {origin.summary ? (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {origin.summary}
                          </p>
                        ) : null}
                        <p className="mt-auto flex items-center gap-2 pt-7 text-xs font-bold text-highlight">
                          <MapPin
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {originsT("coffeeCount", {
                            count: origin.coffeeCount,
                          })}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">{originsT("empty")}</p>
          )}
        </div>
      </section>
    </>
  );
}
