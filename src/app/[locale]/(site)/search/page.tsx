import type { Metadata } from "next";
import { Search as SearchIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionReveal } from "@/components/motion/primitives";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { search } from "@/lib/data/search";

/**
 * Unified public search results.
 *
 * `noindex, nofollow` follows the convention the other utility routes already
 * use (`/sign-in`, `/verify-email`, `/continue`): a results page for an
 * arbitrary query string is not a canonical destination and should not compete
 * with the catalog or the knowledge index in an index. It is also absent from
 * `sitemap.ts`, whose `staticPaths` list is explicit, so nothing had to be
 * excluded there. Any further SEO treatment is a Phase-13 decision.
 */
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function ResultGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 grid gap-3">{children}</ul>
    </section>
  );
}

function ResultLink({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block border border-border bg-card p-5 transition-colors hover:border-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="font-bold">{title}</p>
        {meta ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {meta}
          </p>
        ) : null}
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
  const t = await getTranslations("search");
  const results = await search(locale as Locale, first(query.q) ?? "");

  return (
    <section className="section-space">
      <div className="site-container max-w-4xl">
        <Breadcrumbs
          locale={locale as Locale}
          items={[{ label: t("title") }]}
        />
        <p className="eyebrow mt-4">{t("eyebrow")}</p>
        <h1 className="display-lg mt-4">
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
          className="relative mt-8"
        >
          <label>
            <span className="sr-only">{t("placeholder")}</span>
            <SearchIcon
              className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              name="q"
              type="search"
              defaultValue={results.query}
              placeholder={t("placeholder")}
              className="h-12 w-full rounded-xl border border-input bg-background ps-11 pe-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </form>

        {!results.query ? (
          <p className="mt-8 text-muted-foreground">{t("prompt")}</p>
        ) : results.total === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
            <h2 className="text-2xl">{t("empty", { q: results.query })}</h2>
            <p className="mt-3 text-muted-foreground">{t("emptyHint")}</p>
            <Link
              href="/green-coffee-offer-list"
              className="mt-5 inline-block font-bold text-highlight"
            >
              {t("coffees")}
            </Link>
          </div>
        ) : (
          <SectionReveal className="mt-10">
            <p className="text-sm font-bold" aria-live="polite">
              {t("count", { count: results.total })}
            </p>

            {results.coffees.length ? (
              <ResultGroup title={t("coffees")}>
                {results.coffees.map((coffee) => (
                  <ResultLink
                    key={coffee.id}
                    href={`/green-coffee-offer-list/${coffee.slug}`}
                    title={coffee.name}
                    meta={[coffee.origin, coffee.region, coffee.process]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {results.origins.length ? (
              <ResultGroup title={t("origins")}>
                {results.origins.map((origin) => (
                  <ResultLink
                    key={origin.slug}
                    href={`/coffee-origins/${origin.slug}`}
                    title={origin.name}
                    meta={origin.summary}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {results.articles.length ? (
              <ResultGroup title={t("articles")}>
                {results.articles.map((article) => (
                  <ResultLink
                    key={article.slug}
                    href={`/knowledge/${article.slug}`}
                    title={article.title}
                    meta={article.excerpt}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {results.pages.length ? (
              <ResultGroup title={t("pages")}>
                {results.pages.map((page) => (
                  <ResultLink
                    key={page.href}
                    href={page.href}
                    title={page.title}
                    meta={page.description}
                  />
                ))}
              </ResultGroup>
            ) : null}
          </SectionReveal>
        )}
      </div>
    </section>
  );
}
