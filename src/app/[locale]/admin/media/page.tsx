import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MediaUploadForm } from "@/components/admin/media-upload-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listMedia } from "@/lib/data/media-library";

export const metadata: Metadata = {
  title: "Media library",
  robots: { index: false, follow: false },
};

const readParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";

/**
 * The Media Library (P8-T03).
 *
 * Phase 6 gave coffees their own image workflow; this is the shelf everything
 * else draws from. Search, the active/archived filter and pagination are all
 * evaluated by the database, so the grid stays bounded as the library grows.
 */
export default async function AdminMediaPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/media">) {
  const { locale } = (await params) as { locale: Locale };
  const query = await searchParams;
  const t = await getTranslations("admin.media");

  const search = readParam(query.q);
  const state = readParam(query.state) || "active";
  const page = Math.max(
    1,
    Number.parseInt(readParam(query.page) || "1", 10) || 1,
  );
  const result = await listMedia({ query: search, state, page });

  const numberFormat = new Intl.NumberFormat(locale);
  const pageHref = (next: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (state !== "active") qs.set("state", state);
    if (next > 1) qs.set("page", String(next));
    const encoded = qs.toString();
    return encoded ? `/admin/media?${encoded}` : "/admin/media";
  };

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <form
        method="get"
        className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[2fr_1fr_auto] md:items-end"
      >
        <label className="text-sm font-bold">
          {t("searchLabel")}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("searchHint")}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          {t("stateFilter")}
          <select
            name="state"
            defaultValue={state}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="active">{t("stateActive")}</option>
            <option value="archived">{t("stateArchived")}</option>
            <option value="all">{t("stateAll")}</option>
          </select>
        </label>
        <button className="h-11 min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
          {t("apply")}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {result.configured
          ? t("resultCount", { count: numberFormat.format(result.total) })
          : t("notConfigured")}
      </p>

      {result.items.length ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <Link href={`/admin/media/${item.id}`} className="block">
                <span className="block aspect-[4/3] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      a stored object can be missing; the optimizer would turn
                      that into its own error response. */}
                  <img
                    src={item.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </span>
                <span className="block p-4">
                  <strong className="block truncate text-sm">
                    {item.altEn || t("untitled")}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.width && item.height
                      ? `${item.width}×${item.height}`
                      : "—"}{" "}
                    · {item.mimeType ?? "—"}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {item.archived ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                        {t("archivedBadge")}
                      </span>
                    ) : null}
                    {!item.altAr ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        {t("missingArabicAltShort")}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm font-bold">
            {result.configured
              ? search || state !== "active"
                ? t("noMatches")
                : t("emptyLibrary")
              : t("notConfigured")}
          </p>
          {result.configured && !search && state === "active" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("emptyLibraryCta")}
            </p>
          ) : null}
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav
          aria-label={t("pagination")}
          className="mt-6 flex items-center justify-between gap-3"
        >
          <PageLink
            href={pageHref(result.page - 1)}
            disabled={result.page <= 1}
            label={t("previous")}
            icon={<ChevronLeft className="size-4 rtl:rotate-180" />}
          />
          <span className="text-sm text-muted-foreground">
            {t("pageOf", {
              page: numberFormat.format(result.page),
              pages: numberFormat.format(result.pageCount),
            })}
          </span>
          <PageLink
            href={pageHref(result.page + 1)}
            disabled={result.page >= result.pageCount}
            label={t("next")}
            icon={<ChevronRight className="size-4 rtl:rotate-180" />}
            trailingIcon
          />
        </nav>
      ) : null}

      <MediaUploadForm />
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon,
  trailingIcon = false,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  trailingIcon?: boolean;
}) {
  const className =
    "inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold";
  if (disabled)
    return (
      <span aria-disabled="true" className={`${className} opacity-40`}>
        {trailingIcon ? null : icon}
        {label}
        {trailingIcon ? icon : null}
      </span>
    );
  return (
    <Link href={href} className={`${className} transition hover:border-gold`}>
      {trailingIcon ? null : icon}
      {label}
      {trailingIcon ? icon : null}
    </Link>
  );
}
