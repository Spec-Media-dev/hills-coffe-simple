import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OfferCard } from "@/components/catalog/offer-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import { getOfferList } from "@/lib/data/catalog";
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
  const data = await getOfferList(locale as Locale);
  const viewer = await getViewer();
  const search = (first(query.q) ?? "").trim().toLocaleLowerCase(locale);
  const origin = first(query.origin);
  const process = first(query.process);
  const location = first(query.location);
  const type = first(query.type);
  const certified = first(query.certified) === "true";
  const filtered = data.offers.filter(
    (item) =>
      (!search ||
        [item.name, item.origin, item.region, ...item.sensory]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(search)) &&
      (!origin || item.origin === origin) &&
      (!process || item.process === process) &&
      (!location ||
        item.warehouse
          .toLocaleLowerCase()
          .includes(location.toLocaleLowerCase())) &&
      (!type || item.type === type) &&
      (!certified || item.certifications.length > 0),
  );
  const prices = viewer?.emailVerified
    ? await getProtectedPriceTiers(filtered.map((item) => item.id))
    : new Map();
  const labels = {
    bags: t("bags"),
    pricing: actions("pricing"),
    view: actions("view"),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: filtered.length,
    itemListElement: filtered.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: localizedUrl(
        locale as Locale,
        `/green-coffee-offer-list/${item.slug}`,
      ),
      name: item.name,
    })),
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
              <Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={search}
                placeholder={t("search")}
                className="h-12 w-full rounded-xl border border-input bg-background ps-11 pe-4"
              />
            </label>
            <Filter
              name="origin"
              label={t("origin")}
              value={origin}
              options={data.origins}
              all={nav("all")}
            />
            <Filter
              name="process"
              label={t("process")}
              value={process}
              options={data.processes}
              all={nav("all")}
            />
            <Filter
              name="location"
              label={t("location")}
              value={location}
              options={data.warehouses}
              all={nav("all")}
            />
            <Filter
              name="type"
              label={t("category")}
              value={type}
              options={data.types}
              all={nav("all")}
            />
            <button className="h-12 rounded-xl bg-highlight px-5 font-bold text-white">
              {t("filters")}
            </button>
          </form>
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm font-bold">
              {t("showing", { count: filtered.length })}
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
          {filtered.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <OfferCard
                  key={item.id}
                  item={item}
                  price={prices.get(item.id)?.[0]?.pricePerKgUsd}
                  labels={labels}
                />
              ))}
            </div>
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
  options: string[];
  all: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
      >
        <option value="">
          {label}: {all}
        </option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
