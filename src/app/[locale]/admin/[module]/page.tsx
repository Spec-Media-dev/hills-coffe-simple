import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminArchiveAction } from "@/components/admin/admin-row-actions";
import { AdminModuleForm } from "@/components/admin/admin-module-form";
import { SiteLogoForm } from "@/components/admin/site-logo-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getAdminFormOptions,
  getAdminModuleRows,
  getAdminSiteSettings,
} from "@/lib/data/admin";
import { getMediaItem, listPickableMedia } from "@/lib/data/media-library";

/**
 * The shared workspace for the reference modules.
 *
 * Phase 10 kept this router rather than splitting eight near-identical
 * screens: these modules genuinely are the same shape — a list, a create form,
 * an edit link and an archive control — and one surface means one place where
 * the empty state, the record count and the responsive behaviour are correct.
 *
 * What changed is everything the Admin reads. The heading was the raw route
 * slug (`article-categories`), untranslated in both languages; there was no
 * statement of what a page controls; an empty database and an empty search
 * result looked identical; and the audit search and pagination were hardcoded
 * English (findings N65, N68).
 */

const modules = [
  // "products", "offers" and "pricing" are deliberately absent: each has a
  // dedicated workspace with dependent selects, inline validation and image
  // management the generic renderer cannot express.
  "origins",
  "regions",
  "varieties",
  "warehouses",
  "taxonomy",
  // "users", "inquiries", "media", "content" and "articles" likewise have
  // their own workspaces.
  "article-categories",
  "settings",
  "audit",
] as const;

type Module = (typeof modules)[number];

/** Which nav group a module belongs to, for the eyebrow above its title. */
const EYEBROW: Record<Module, string> = {
  origins: "eyebrow",
  regions: "eyebrow",
  varieties: "eyebrow",
  warehouses: "eyebrow",
  taxonomy: "eyebrow",
  "article-categories": "contentEyebrow",
  settings: "systemEyebrow",
  audit: "systemEyebrow",
};

/** The message key holding each module's title and its purpose sentence. */
const COPY: Record<Module, { title: string; intro: string }> = {
  origins: { title: "originsTitle", intro: "originsIntro" },
  regions: { title: "regionsTitle", intro: "regionsIntro" },
  varieties: { title: "varietiesTitle", intro: "varietiesIntro" },
  warehouses: { title: "warehousesTitle", intro: "warehousesIntro" },
  taxonomy: { title: "taxonomyTitle", intro: "taxonomyIntro" },
  "article-categories": {
    title: "articleCategoriesTitle",
    intro: "articleCategoriesIntro",
  },
  settings: { title: "settingsTitle", intro: "settingsIntro" },
  audit: { title: "auditTitle", intro: "auditIntro" },
};

/** Modules whose rows open a dedicated edit form. */
const EDITABLE = new Set<Module>([
  "origins",
  "regions",
  "varieties",
  "warehouses",
  "taxonomy",
  "article-categories",
]);

/** Rows that may be retired, keyed by the entity the archive action expects. */
const ARCHIVABLE = new Set([
  "origins",
  "regions",
  "warehouses",
  "varieties",
  "coffee_types",
  "processing_methods",
  "packaging_types",
  "sensory_notes",
  "certifications",
  "tags",
  "article_categories",
]);

const AUDIT_PAGE_SIZE = 25;

export default async function AdminModulePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/[module]">) {
  const { module, locale } = await params;
  const query = await searchParams;
  if (!modules.includes(module as Module)) notFound();
  const key = module as Module;

  const t = await getTranslations("admin.modules");
  const [rows, options, settings, logoMedia] = await Promise.all([
    getAdminModuleRows(module, locale as Locale),
    getAdminFormOptions(locale as Locale),
    key === "settings" ? getAdminSiteSettings() : Promise.resolve(null),
    // The logo picker belongs to Site settings, so its library is loaded
    // only for that module.
    key === "settings" ? listPickableMedia() : Promise.resolve([]),
  ]);
  const currentLogoId = settings?.settings.org_logo_media_id
    ? String(settings.settings.org_logo_media_id)
    : null;
  const currentLogo = currentLogoId ? await getMediaItem(currentLogoId) : null;

  const search =
    typeof query.q === "string" ? query.q.trim().toLocaleLowerCase() : "";
  const page = Math.max(
    1,
    Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1,
  );
  const filtered =
    key === "audit" && search
      ? rows.filter((row) =>
          [row.primary, row.secondary, row.detail].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ),
        )
      : rows;
  const pageCount = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
  const displayed =
    key === "audit"
      ? filtered.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE)
      : filtered;

  const numberFormat = new Intl.NumberFormat(locale);
  const auditHref = (next: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (next > 1) qs.set("page", String(next));
    const encoded = qs.toString();
    return encoded ? `/admin/audit?${encoded}` : "/admin/audit";
  };

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t(EYEBROW[key] as Parameters<typeof t>[0])}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">
        {t(COPY[key].title as Parameters<typeof t>[0])}
      </h1>
      {/* What this page controls, before any form appears. */}
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {t(COPY[key].intro as Parameters<typeof t>[0])}
      </p>

      {key === "audit" ? (
        <form
          method="get"
          className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_auto] md:items-end"
        >
          <label className="text-sm font-bold">
            {t("auditSearch")}
            <span className="relative mt-1.5 block">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                defaultValue={typeof query.q === "string" ? query.q : ""}
                placeholder={t("auditSearchHint")}
                className="h-11 w-full rounded-lg border border-input bg-background ps-10 pe-3 font-normal"
              />
            </span>
          </label>
          <button className="h-11 min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            {t("auditFilter")}
          </button>
        </form>
      ) : null}

      {/* The create form comes after the explanation, never before it. */}
      <AdminModuleForm module={module} options={options} settings={settings} />

      {key === "settings" ? (
        <div className="mt-8">
          <SiteLogoForm
            media={logoMedia.map((item) => ({
              id: item.id,
              url: item.url,
              width: item.width,
              height: item.height,
              altEn: item.altEn,
              altAr: item.altAr,
              storagePath: item.storagePath,
            }))}
            currentMediaId={currentLogoId}
            currentPreviewUrl={currentLogo?.url ?? null}
          />
        </div>
      ) : null}

      {key === "settings" ? null : (
        <>
          <p
            className="mt-9 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {t("recordCount", { count: numberFormat.format(filtered.length) })}
          </p>

          {displayed.length ? (
            <ul className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
              {displayed.map((row) => (
                <li
                  key={row.id}
                  // Stacks on a phone and becomes columns from `sm`, so a wide
                  // table is never forced onto a 375px screen.
                  className="grid gap-3 border-b border-border p-5 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <strong className="block break-words">{row.primary}</strong>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {row.secondary}
                    </span>
                  </div>
                  <span className="min-w-0 text-sm break-words">
                    {row.detail}
                  </span>
                  <span className="justify-self-start rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold whitespace-nowrap capitalize">
                    {row.status}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {EDITABLE.has(key) ? (
                      <Link
                        href={`/admin/${module}/${row.id}${
                          key === "taxonomy" && row.entity
                            ? `?entity=${row.entity}`
                            : ""
                        }`}
                        className="inline-flex h-11 min-h-11 items-center rounded-lg border border-border px-3 text-xs font-bold transition hover:border-gold"
                      >
                        {t("edit")}
                      </Link>
                    ) : null}
                    {ARCHIVABLE.has(row.entity ?? module) &&
                    row.status !== "deleted" &&
                    row.status !== "inactive" ? (
                      <AdminArchiveAction
                        id={row.id}
                        entity={row.entity ?? module}
                        recordName={row.primary}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center">
              {/* An empty database and an empty search result are different
                  problems and now say so. */}
              <p className="text-sm font-bold">
                {search ? t("noResults") : t("empty")}
              </p>
              {search ? (
                <Link
                  href="/admin/audit"
                  className="mt-3 inline-flex h-11 min-h-11 items-center rounded-full border border-border px-5 text-sm font-bold transition hover:border-gold"
                >
                  {t("clearFilters")}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("emptyCta")}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {key === "audit" && pageCount > 1 ? (
        <nav
          aria-label={t("auditPagination")}
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
        >
          <PageLink
            href={auditHref(page - 1)}
            disabled={page <= 1}
            label={t("previous")}
            // Logical direction: the chevrons mirror themselves in RTL.
            icon={<ChevronLeft className="size-4 rtl:rotate-180" />}
          />
          <span className="text-sm text-muted-foreground">
            {t("pageOf", {
              page: numberFormat.format(Math.min(page, pageCount)),
              pages: numberFormat.format(pageCount),
            })}
          </span>
          <PageLink
            href={auditHref(page + 1)}
            disabled={page >= pageCount}
            label={t("next")}
            icon={<ChevronRight className="size-4 rtl:rotate-180" />}
            trailingIcon
          />
        </nav>
      ) : null}
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
