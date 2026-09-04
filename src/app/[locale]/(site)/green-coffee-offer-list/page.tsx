import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogItem } from "@/components/catalog/catalog-item";
import { AuthCta } from "@/components/auth/auth-cta";
import {
  FilterTransition,
  SectionReveal,
} from "@/components/motion/primitives";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublicPersona } from "@/lib/auth/persona";
import {
  getCatalogFacets,
  getCatalogRowDetails,
  isCatalogSort,
  queryCatalog,
  type CatalogFilters as Filters,
} from "@/lib/data/catalog-query";
import { getProtectedPriceTiers } from "@/lib/data/pricing";
import { publicOfferStatusKey } from "@/lib/public-labels";
import { collectionPageJsonLd, jsonLdScript } from "@/lib/seo/collection";
import { localizedMetadata, localizedUrl } from "@/lib/seo/metadata";
import type { OfferStatus } from "@/lib/supabase/types.generated";

/**
 * Catalog parameters that produce a *filtered view* of the same inventory.
 *
 * `page` is deliberately absent: paginated pages are genuinely different
 * content and stay crawlable and self-canonical, which is what keeps deep lots
 * reachable. Everything here, by contrast, is a re-slice of the same hub.
 */
const FILTER_PARAMS = [
  "q",
  "origin",
  "process",
  "location",
  "type",
  "availability",
  "certified",
  "sort",
] as const;

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/green-coffee-offer-list">): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const meta = await getTranslations({ locale, namespace: "seo" });

  /*
   * Filter and search states must not become indexable pages.
   *
   * The catalog exposes eight filter parameters plus free text, so the number
   * of reachable URLs is combinatorial while the content is one inventory
   * viewed different ways. Left indexable they would compete with the hub for
   * the same query and dilute it. `follow` is kept so the lots linked from a
   * filtered view are still discovered, and the canonical points back at the
   * clean hub so any equity a filtered URL attracts consolidates there.
   *
   * Shareability is untouched: the URLs still work, still render, and still
   * carry their filters. Only their indexing instruction changes.
   */
  const filtered = FILTER_PARAMS.some((key) => {
    const value = query[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

  const base = localizedMetadata({
    locale: locale as Locale,
    path: "/green-coffee-offer-list",
    title: meta("offerListTitle"),
    description: meta("offerListDescription"),
  });

  return filtered ? { ...base, robots: { index: false, follow: true } } : base;
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Publicly meaningful availability values; `INACTIVE` is not a buyer state. */
const AVAILABILITY: OfferStatus[] = [
  "ARRIVING_SOON",
  "NEW_ARRIVAL",
  "IN_STORE",
  "DISCOUNT",
  "SOLD_OUT",
];

export default async function OfferListPage({
  params,
  searchParams,
}: PageProps<"/[locale]/green-coffee-offer-list">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const actions = await getTranslations("actions");
  const product = await getTranslations("product");
  const cta = await getTranslations("cta");

  const availabilityParam = first(query.availability);
  const sortParam = first(query.sort);
  const filters: Filters = {
    q: (first(query.q) ?? "").trim() || undefined,
    origin: first(query.origin) || undefined,
    process: first(query.process) || undefined,
    location: first(query.location) || undefined,
    type: first(query.type) || undefined,
    certified: first(query.certified) === "1" || undefined,
    // Unknown values are dropped rather than forwarded to the database.
    availability: AVAILABILITY.includes(availabilityParam as OfferStatus)
      ? (availabilityParam as OfferStatus)
      : undefined,
    sort: isCatalogSort(sortParam) ? sortParam : undefined,
    page: Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1),
  };

  // Filtering, ordering and pagination are all evaluated by the database, so
  // the page transfers one page of rows whatever the catalog's size.
  const [result, facets, persona] = await Promise.all([
    queryCatalog(locale as Locale, filters),
    getCatalogFacets(locale as Locale),
    getPublicPersona(),
  ]);

  /*
   * Two reads scoped to the rows already on this page.
   *
   * `getProtectedPriceTiers` is gated internally by `requireVerifiedUser()`;
   * asking only for a persona that could possibly be entitled avoids a pointless
   * round trip, but the gate — not this check — is what enforces the rule. An
   * Administrator reaches the helper and still receives nothing.
   */
  const [details, prices] = await Promise.all([
    getCatalogRowDetails(result.rows, locale as Locale),
    persona === "verified"
      ? getProtectedPriceTiers(result.rows.map((item) => item.id))
      : Promise.resolve(new Map()),
  ]);

  const activeFilterCount = [
    filters.q,
    filters.origin,
    filters.process,
    filters.location,
    filters.type,
    filters.availability,
    filters.sort,
    filters.certified,
  ].filter(Boolean).length;

  /*
   * Structured data describes only what this page shows, and never a price.
   * The list mirrors the rendered rows exactly; the CollectionPage anchors it
   * to the *clean* hub URL rather than the filtered one, so a filtered view
   * consolidates onto the canonical hub instead of declaring a second entity.
   */
  const jsonLd = collectionPageJsonLd({
    locale: locale as Locale,
    canonical: localizedUrl(locale as Locale, "/green-coffee-offer-list"),
    name: t("title"),
    description: t("intro"),
    items: result.rows.map((item) => ({
      name: item.name,
      url: localizedUrl(
        locale as Locale,
        `/green-coffee-offer-list/${item.slug}`,
      ),
    })),
  });

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.origin) qs.set("origin", filters.origin);
    if (filters.process) qs.set("process", filters.process);
    if (filters.location) qs.set("location", filters.location);
    if (filters.type) qs.set("type", filters.type);
    if (filters.availability) qs.set("availability", filters.availability);
    if (filters.sort) qs.set("sort", filters.sort);
    if (filters.certified) qs.set("certified", "1");
    if (page > 1) qs.set("page", String(page));
    const value = qs.toString();
    return value
      ? `/green-coffee-offer-list?${value}`
      : "/green-coffee-offer-list";
  };

  /*
   * One banner above the results rather than a lock repeated on every row.
   * `verified` gets nothing here because the prices themselves are the answer.
   */
  const pricingNotice =
    persona === "verified"
      ? null
      : persona === "unverified"
        ? {
            title: t("pricingVerifyTitle"),
            body: t("pricingVerifyBody"),
          }
        : persona === "blocked"
          ? {
              title: t("pricingBlockedTitle"),
              body: t("pricingBlockedBody"),
            }
          : persona === "admin"
            ? null
            : { title: t("pricingLockedTitle"), body: t("pricingLockedBody") };

  /** One line, correct for whoever is reading it. */
  const pricingHeadline =
    persona === "verified"
      ? t("pricingVisible")
      : persona === "unverified"
        ? t("pricingVerifyTitle")
        : persona === "blocked"
          ? t("pricingBlockedTitle")
          : persona === "admin"
            ? t("eyebrow")
            : t("pricingLockedTitle");

  /** The sentence under the headline, matched to the same reader. */
  const pricingSubline =
    persona === "verified"
      ? t("intro")
      : persona === "unverified"
        ? t("pricingVerifyBody")
        : persona === "blocked"
          ? t("pricingBlockedBody")
          : persona === "admin"
            ? t("intro")
            : t("pricingLockedBody");

  const itemLabels = {
    bags: t("bags"),
    bagWeight: t("bagWeight"),
    view: actions("view"),
    expand: t("expand"),
    collapse: t("collapse"),
    reference: product("reference"),
    grade: t("grade"),
    region: product("region"),
    process: product("process"),
    warehouse: t("warehouse"),
    cupScore: product("score"),
    availableFrom: t("availableFrom"),
    packaging: product("packaging"),
    certifications: t("certifications"),
    tags: t("tags"),
    sensory: product("sensory"),
    variety: product("variety"),
    status: product("status"),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(jsonLd),
        }}
      />
      <section className="border-b border-border bg-primary py-14 text-primary-foreground md:py-20">
        <SectionReveal className="site-container grid gap-10 lg:grid-cols-[1fr_.45fr] lg:items-end">
          <div>
            <Breadcrumbs
              locale={locale as Locale}
              items={[{ label: t("title") }]}
              inverted
            />
            <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
            <h1 className="display-lg mt-5 max-w-4xl">{t("title")}</h1>
            <p className="mt-6 max-w-2xl text-white/70">{t("intro")}</p>
          </div>
          <div className="border-s border-white/20 ps-6 text-sm leading-7 text-white/65">
            {/*
             * This aside used to state "Sign in to view pricing" to every
             * visitor, including customers who were already signed in and
             * verified, and Administrators who are not customers at all.
             */}
            <p className="font-bold text-gold-bright">{pricingHeadline}</p>
            <p>{pricingSubline}</p>
          </div>
        </SectionReveal>
      </section>
      <section className="section-space">
        <div className="site-container">
          <CatalogFilters
            action="/green-coffee-offer-list"
            activeCount={activeFilterCount}
            values={{
              q: filters.q ?? "",
              origin: filters.origin ?? "",
              process: filters.process ?? "",
              location: filters.location ?? "",
              type: filters.type ?? "",
              availability: filters.availability ?? "",
              sort: filters.sort ?? "",
              certified: Boolean(filters.certified),
            }}
            options={{
              origins: facets.origins.map((o) => ({
                value: o.slug,
                label: o.label,
              })),
              processes: facets.processes.map((p) => ({
                value: p.slug,
                label: p.label,
              })),
              locations: facets.warehouses.map((w) => ({
                value: w.code,
                label: w.label,
              })),
              types: facets.types.map((c) => ({
                value: c.slug,
                label: c.label,
              })),
              availability: AVAILABILITY.map((status) => ({
                value: status,
                label: product(publicOfferStatusKey(status)),
              })),
              sorts: [
                { value: "reference", label: t("sortDefault") },
                { value: "cup-score", label: t("sortCupScore") },
                { value: "bags", label: t("sortBags") },
              ],
            }}
            labels={{
              filters: t("filters"),
              search: t("search"),
              origin: t("origin"),
              process: t("process"),
              location: t("location"),
              category: t("category"),
              availability: t("availability"),
              sort: t("sort"),
              certified: t("certified"),
              clear: actions("clear"),
              apply: actions("apply"),
              applying: t("applying"),
            }}
          />

          {pricingNotice ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Lock
                  className="mt-0.5 size-4 shrink-0 text-highlight"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-bold">{pricingNotice.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pricingNotice.body}
                  </p>
                </div>
              </div>
              <AuthCta
                persona={persona}
                className="inline-flex min-h-11 items-center bg-primary px-5 py-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                map={{
                  anonymous: { label: cta("signIn"), href: "/sign-in" },
                  unverified: {
                    label: cta("verifyEmail"),
                    href: "/verify-email",
                  },
                  blocked: { label: cta("contactSupport"), href: "/contact" },
                  admin: null,
                  verified: null,
                }}
              />
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm font-bold" aria-live="polite">
              {t("showing", { count: result.total })}
            </p>
            {Object.keys(query).length ? (
              <Link
                href="/green-coffee-offer-list"
                className="text-sm font-bold text-highlight"
              >
                {actions("clear")}
              </Link>
            ) : null}
          </div>

          {result.rows.length ? (
            <>
              <FilterTransition
                className="mt-6 grid gap-3"
                aria-label={t("results")}
              >
                {result.rows.map((item) => (
                  <CatalogItem
                    key={item.id}
                    item={item}
                    detail={details.get(item.id)}
                    price={prices.get(item.id)?.[0]?.pricePerKgUsd}
                    statusLabel={product(publicOfferStatusKey(item.status))}
                    labels={itemLabels}
                  />
                ))}
              </FilterTransition>
              {result.pageCount > 1 ? (
                <nav
                  aria-label={t("title")}
                  className="mt-10 flex items-center justify-between gap-3"
                >
                  <PageLink
                    href={pageHref(result.page - 1)}
                    disabled={result.page <= 1}
                    label={actions("previous")}
                    icon={
                      <ChevronLeft
                        className="size-4 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {result.page} / {result.pageCount}
                  </span>
                  <PageLink
                    href={pageHref(result.page + 1)}
                    disabled={result.page >= result.pageCount}
                    label={actions("next")}
                    icon={
                      <ChevronRight
                        className="size-4 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    }
                    trailing
                  />
                </nav>
              ) : null}
            </>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
              <h2 className="text-2xl">{t("noResults")}</h2>
              <Link
                href="/green-coffee-offer-list"
                className="mt-5 inline-block font-bold text-highlight"
              >
                {t("reset")}
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon,
  trailing = false,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  trailing?: boolean;
}) {
  const className =
    "inline-flex h-12 min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold";
  if (disabled)
    return (
      <span aria-disabled="true" className={`${className} opacity-40`}>
        {trailing ? null : icon}
        {label}
        {trailing ? icon : null}
      </span>
    );
  return (
    <Link href={href} className={`${className} hover:border-highlight`}>
      {trailing ? null : icon}
      {label}
      {trailing ? icon : null}
    </Link>
  );
}
