import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  MapPin,
  Search as SearchIcon,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogItem } from "@/components/catalog/catalog-item";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { search } from "@/lib/data/search";
import { publicOfferStatusKey } from "@/lib/public-labels";

/**
 * Unified public search results.
 *
 * `noindex, nofollow` follows the convention the other utility routes already
 * use (`/sign-in`, `/verify-email`, `/continue`): a results page for an
 * arbitrary query string is not a canonical destination and should not compete
 * with the catalog or the knowledge index in an index. It is also absent from
 * `sitemap.ts`, whose `staticPaths` list is explicit, so nothing had to be
 * excluded there. Any further SEO treatment is a Phase-13 decision.
 *
 * Coffee results render with the catalog's own row component (`CatalogItem`,
 * `result` variant), fed by the same published-only, price-free catalog query
 * and batched detail read as the offer list. No price is passed: search never
 * reads protected pricing, whoever is signed in.
 */
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="flex items-baseline gap-3 border-b border-border pb-3">
        <span className="eyebrow">{title}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </h2>
      <ul className="mt-5 grid gap-4">{children}</ul>
    </section>
  );
}

function ResultLink({
  href,
  title,
  meta,
  icon: Icon,
  lang,
}: {
  href: string;
  title: string;
  meta?: string | null;
  icon: typeof MapPin;
  lang?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] duration-300 hover:border-highlight/60 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-gold-bright">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span lang={lang} className="display-title block text-xl">
            {title}
          </span>
          {meta ? (
            <span className="mt-1.5 line-clamp-2 block text-sm leading-6 text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
        <ArrowUpRight
          className="mt-1 size-4 shrink-0 text-highlight transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/search">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const [t, catalogT, product, actions, results] = await Promise.all([
    getTranslations("search"),
    getTranslations("catalog"),
    getTranslations("product"),
    getTranslations("actions"),
    search(locale as Locale, first(query.q) ?? ""),
  ]);

  const itemLabels = {
    bags: catalogT("bags"),
    bagWeight: catalogT("bagWeight"),
    view: actions("view"),
    expand: catalogT("expand"),
    collapse: catalogT("collapse"),
    reference: product("reference"),
    grade: catalogT("grade"),
    region: product("region"),
    process: product("process"),
    warehouse: catalogT("warehouse"),
    cupScore: product("score"),
    availableFrom: catalogT("availableFrom"),
    packaging: product("packaging"),
    certifications: catalogT("certifications"),
    tags: catalogT("tags"),
    sensory: product("sensory"),
    variety: product("variety"),
    status: product("status"),
  };

  return (
    <>
      <section className="border-b border-border bg-primary py-12 text-primary-foreground md:py-16">
        <div className="site-container max-w-5xl">
          <Breadcrumbs
            locale={locale as Locale}
            items={[{ label: t("title") }]}
            inverted
          />
          <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
          <h1 className="display-lg mt-4 max-w-4xl">
            {results.query ? t("resultsFor", { q: results.query }) : t("title")}
          </h1>

          {/*
           * A plain GET form, so the results page is usable on its own — with a
           * bookmark, with the header collapsed, or with no JavaScript at all.
           */}
          <form
            role="search"
            action="/search"
            method="get"
            className="relative mt-8 max-w-2xl"
          >
            <label>
              <span className="sr-only">{t("placeholder")}</span>
              <SearchIcon
                className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-white/60"
                aria-hidden="true"
              />
              <input
                name="q"
                type="search"
                defaultValue={results.query}
                placeholder={t("placeholder")}
                className="nav-field h-12 w-full rounded-full border ps-11 pe-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright"
              />
            </label>
          </form>

          {results.query && results.total > 0 ? (
            <p
              className="mt-5 text-sm font-semibold text-white/75"
              aria-live="polite"
            >
              {t("count", { count: results.total })}
            </p>
          ) : null}
        </div>
      </section>

      <section className="section-space-tight">
        <div className="site-container max-w-5xl">
          {!results.query ? (
            <p className="text-muted-foreground">{t("prompt")}</p>
          ) : results.total === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center sm:px-12">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-gold-bright">
                <SearchIcon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="display-title mt-5 text-2xl">
                {t("empty", { q: results.query })}
              </h2>
              <p className="mt-3 text-muted-foreground">{t("emptyHint")}</p>
              <Link
                href="/green-coffee-offer-list"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-forest-light"
              >
                {t("coffees")}
                <ArrowUpRight
                  className="size-4 rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </Link>
            </div>
          ) : (
            <>
              {results.coffees.length ? (
                <ResultGroup title={t("coffees")} count={results.coffeeTotal}>
                  {results.coffees.map((coffee) => (
                    <li key={coffee.id}>
                      <CatalogItem
                        variant="result"
                        item={coffee}
                        detail={results.coffeeDetails.get(coffee.id)}
                        statusLabel={product(
                          publicOfferStatusKey(coffee.status),
                        )}
                        labels={itemLabels}
                      />
                    </li>
                  ))}
                  {results.coffeeTotal > results.coffees.length ? (
                    <li className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                      <span className="text-muted-foreground">
                        {t("coffeesShown", {
                          shown: results.coffees.length,
                          total: results.coffeeTotal,
                        })}
                      </span>
                      <Link
                        href={`/green-coffee-offer-list?q=${encodeURIComponent(results.query)}`}
                        className="inline-flex items-center gap-2 font-bold text-highlight"
                      >
                        {t("viewAllCoffees")}
                        <ArrowUpRight
                          className="size-4 rtl:-scale-x-100"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ) : null}
                </ResultGroup>
              ) : null}

              {results.origins.length ? (
                <ResultGroup
                  title={t("origins")}
                  count={results.origins.length}
                >
                  {results.origins.map((origin) => (
                    <ResultLink
                      key={origin.slug}
                      href={`/coffee-origins/${origin.slug}`}
                      title={origin.name}
                      meta={origin.summary}
                      icon={MapPin}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {results.articles.length ? (
                <ResultGroup
                  title={t("articles")}
                  count={results.articles.length}
                >
                  {results.articles.map((article) => (
                    <ResultLink
                      key={article.slug}
                      href={`/knowledge/${article.slug}`}
                      title={article.title}
                      meta={article.excerpt}
                      icon={BookOpen}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {results.pages.length ? (
                <ResultGroup title={t("pages")} count={results.pages.length}>
                  {results.pages.map((page) => (
                    <ResultLink
                      key={page.href}
                      href={page.href}
                      title={page.title}
                      meta={page.description}
                      icon={FileText}
                    />
                  ))}
                </ResultGroup>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}
