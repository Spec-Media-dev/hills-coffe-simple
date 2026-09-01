import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogCard } from "@/components/catalog/catalog-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import {
  getCatalogFacets,
  queryCatalog,
  type CatalogFilters,
} from "@/lib/data/catalog-query";
import { getProtectedPriceTiers } from "@/lib/data/pricing";
import { localizedMetadata, localizedUrl } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/green-coffee-offer-list">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/green-coffee-offer-list",
    title: meta("offerListTitle"),
    description:
      locale === "ar"
        ? "تصفح عروض القهوة الخضراء المتاحة من هيلز كوفي."
        : "Browse green coffee offers available from Hills Coffee.",
  });
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function OfferListPage({
  params,
  searchParams,
}: PageProps<"/[locale]/green-coffee-offer-list">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const actions = await getTranslations("actions");
  const nav = await getTranslations("nav");

  const filters: CatalogFilters = {
    q: (first(query.q) ?? "").trim() || undefined,
    origin: first(query.origin) || undefined,
    process: first(query.process) || undefined,
    location: first(query.location) || undefined,
    type: first(query.type) || undefined,
    page: Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1),
  };

  // Filtering, ordering and pagination are all evaluated by the database, so
  // the page transfers one page of rows whatever the catalog's size.
  const [result, facets] = await Promise.all([
    queryCatalog(locale as Locale, filters),
    getCatalogFacets(locale as Locale),
  ]);

  // The price read is gated inside `getProtectedPriceTiers` by
  // `requireVerifiedUser()`; this check only avoids a pointless round trip for
  // visitors who cannot possibly be entitled.
  const viewer = await getViewer();
  const prices = viewer?.emailVerified
    ? await getProtectedPriceTiers(result.rows.map((item) => item.id))
    : new Map();

  const labels = {
    bags: t("bags"),
    pricing: actions("pricing"),
    view: actions("view"),
  };

  // Structured data describes only what this page shows, and never a price.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: result.rows.length,
    itemListElement: result.rows.map((item, index) => ({
      "@type": "ListItem",
      position: (result.page - 1) * result.pageSize + index + 1,
      url: localizedUrl(
        locale as Locale,
        `/green-coffee-offer-list/${item.slug}`,
      ),
      name: item.name,
    })),
  };

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.origin) qs.set("origin", filters.origin);
    if (filters.process) qs.set("process", filters.process);
    if (filters.location) qs.set("location", filters.location);
    if (filters.type) qs.set("type", filters.type);
    if (page > 1) qs.set("page", String(page));
    const value = qs.toString();
    return value
      ? `/green-coffee-offer-list?${value}`
      : "/green-coffee-offer-list";
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="border-b border-border bg-primary py-16 text-primary-foreground md:py-24">
        <div className="site-container">
          <Breadcrumbs
            locale={locale as Locale}
            items={[{ label: t("title") }]}
            inverted
          />
          <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
          <h1 className="display-lg mt-5 max-w-4xl">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-white/70">{t("intro")}</p>
        </div>
      </section>
      <section className="section-space">
        <div className="site-container">
          <form
            className="grid gap-3 rounded-[1.5rem] border border-border bg-card p-4 lg:grid-cols-[2fr_repeat(4,1fr)_auto]"
            role="search"
          >
            <label className="relative">
              <span className="sr-only">{t("search")}</span>
              <Search
                className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder={t("search")}
                className="h-12 w-full rounded-xl border border-input bg-background ps-11 pe-4"
              />
            </label>
            <Filter
              name="origin"
              label={t("origin")}
              value={filters.origin}
              options={facets.origins.map((o) => ({
                value: o.slug,
                label: o.label,
              }))}
              all={nav("all")}
            />
            <Filter
              name="process"
              label={t("process")}
              value={filters.process}
              options={facets.processes.map((p) => ({
                value: p.slug,
                label: p.label,
              }))}
              all={nav("all")}
            />
            <Filter
              name="location"
              label={t("location")}
              value={filters.location}
              options={facets.warehouses.map((w) => ({
                value: w.code,
                label: w.label,
              }))}
              all={nav("all")}
            />
            <Filter
              name="type"
              label={t("category")}
              value={filters.type}
              options={facets.types.map((c) => ({
                value: c.slug,
                label: c.label,
              }))}
              all={nav("all")}
            />
            <button className="h-12 rounded-xl bg-highlight px-5 font-bold text-white">
              {t("filters")}
            </button>
          </form>

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
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {result.rows.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    price={prices.get(item.id)?.[0]?.pricePerKgUsd}
                    labels={labels}
                  />
                ))}
              </div>
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

function Filter({
  name,
  label,
  value,
  options,
  all,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  all: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-12 w-full rounded-xl border border-input bg-background px-4"
      >
        <option value="">
          {label} — {all}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
