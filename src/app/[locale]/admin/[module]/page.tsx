import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getAdminFormOptions,
  getAdminModuleRows,
  getAdminSiteSettings,
} from "@/lib/data/admin";
import {
  archiveAdminRecordAction,
  updateWorkflowStatusAction,
} from "@/actions/admin-operations";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminModuleForm } from "@/components/admin/admin-module-form";
import { SiteLogoForm } from "@/components/admin/site-logo-form";
import { getMediaItem, listPickableMedia } from "@/lib/data/media-library";

const modules = [
  // "products", "offers" and "pricing" are deliberately absent: each has a
  // dedicated workspace under `admin/products|offers|pricing` with dependent
  // selects, inline validation and image management the generic renderer
  // cannot express. The static segments win the route match anyway; removing
  // them here keeps that intentional rather than incidental.
  // "inquiries" is deliberately absent: the Lead Inbox has its own workspace
  // at `admin/inquiries/**` (server-side search/filter/pagination, request
  // context, immutable status timeline, prior same-coffee history, and only
  // the status actions the request's own lifecycle allows). The static
  // segment wins the route match anyway — removing it here keeps that
  // intentional rather than incidental.
  "origins",
  "taxonomy",
  // "users" is deliberately absent: the customer directory has its own
  // workspace at `admin/users/**` (search, pagination, block/unblock, detail),
  // which the generic renderer cannot express. The static segment would win
  // the route match anyway — removing it here keeps that intentional rather
  // than incidental.
  // "content" is deliberately absent: CMS pages have their own workspace at
  // `admin/content/**` (page list with per-language translation state, the
  // settings/publish split, and the section editor driven by the typed
  // registry).
  "settings",
  "regions",
  "warehouses",
  // "media" is deliberately absent: the Media Library has its own workspace
  // at `admin/media/**` (grid, search, active/archived filter, upload,
  // per-item alt text, usage list and reference-aware archiving), none of
  // which the generic renderer can express.
  // "articles" is deliberately absent: they have their own workspace at
  // `admin/articles/**`, with both translations, a featured image from the
  // media library, and publish/archive controls.
  "article-categories",
  "varieties",
  "audit",
] as const;
export default async function AdminModulePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/[module]">) {
  const { module, locale } = await params;
  const query = await searchParams;
  const ops = await getTranslations("admin.ops");
  if (!modules.includes(module as (typeof modules)[number])) notFound();
  const [rows, options, settings, logoMedia] = await Promise.all([
    getAdminModuleRows(module, locale as Locale),
    getAdminFormOptions(locale as Locale),
    module === "settings" ? getAdminSiteSettings() : Promise.resolve(null),
    // The logo picker is part of Site settings (P8-T02), so its library is
    // loaded only for that module.
    module === "settings" ? listPickableMedia() : Promise.resolve([]),
  ]);
  const currentLogoId = settings?.settings.org_logo_media_id
    ? String(settings.settings.org_logo_media_id)
    : null;
  const currentLogo = currentLogoId ? await getMediaItem(currentLogoId) : null;
  const auditQuery =
    typeof query.q === "string" ? query.q.trim().toLocaleLowerCase() : "";
  const auditPage = Math.max(
    1,
    Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1,
  );
  const filteredRows =
    module === "audit" && auditQuery
      ? rows.filter((row) =>
          [row.primary, row.secondary, row.detail].some((value) =>
            value.toLocaleLowerCase().includes(auditQuery),
          ),
        )
      : rows;
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayedRows =
    module === "audit"
      ? filteredRows.slice((auditPage - 1) * pageSize, auditPage * pageSize)
      : filteredRows;
  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{ops("operations")}</p>
      <h1 className="mt-4 text-5xl capitalize">
        {module.replaceAll("-", " ")}
      </h1>
      <AdminModuleForm module={module} options={options} settings={settings} />
      {module === "settings" ? (
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
      {module === "audit" ? (
        <form
          method="get"
          className="mt-7 flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <label className="min-w-64 flex-1 text-sm font-bold">
            Search audit events
            <input
              type="search"
              name="q"
              defaultValue={typeof query.q === "string" ? query.q : ""}
              placeholder="Action, entity, actor, or record ID"
              className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
            />
          </label>
          <button className="self-end rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
            Filter
          </button>
        </form>
      ) : null}
      <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-card">
        {displayedRows.length ? (
          displayedRows.map((row) => (
            <article
              key={row.id}
              className="grid gap-2 border-b border-border p-5 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr_.7fr_auto] sm:items-center"
            >
              <strong>{row.primary}</strong>
              <span className="text-sm text-muted-foreground">
                {row.secondary}
              </span>
              <span className="text-sm">{row.detail}</span>
              <span className="justify-self-start rounded-full bg-muted px-3 py-1 text-xs font-bold capitalize">
                {row.status}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <RowAction
                  module={module}
                  id={row.id}
                  status={row.status}
                  actionValue={row.actionValue}
                  secondary={row.secondary}
                  detail={row.detail}
                  entity={row.entity}
                />
                {[
                  "products",
                  "offers",
                  "origins",
                  "regions",
                  "warehouses",
                  "varieties",
                  "article-categories",
                  "taxonomy",
                ].includes(module) ? (
                  <Link
                    href={`/admin/${module}/${row.id}${
                      module === "taxonomy" && row.entity
                        ? `?entity=${row.entity}`
                        : ""
                    }`}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                  >
                    {ops("edit")}
                  </Link>
                ) : null}
              </div>
              {row.sampleHistory?.length ? (
                <details className="sm:col-span-full rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-bold">
                    {ops("previousSamples", {
                      count: row.sampleHistory.length,
                    })}
                  </summary>
                  <ul className="mt-2 grid gap-1 text-muted-foreground">
                    {row.sampleHistory.map((entry) => (
                      <li key={`${entry.requestCode}-${entry.createdAt}`}>
                        {entry.requestCode} · {entry.status} · {entry.createdAt}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))
        ) : (
          <div className="py-24 text-center text-sm text-muted-foreground">
            {ops("noRecords")}
          </div>
        )}
      </div>
      {module === "audit" && pageCount > 1 ? (
        <nav
          aria-label="Audit pagination"
          className="mt-5 flex items-center gap-3"
        >
          {auditPage > 1 ? (
            <Link
              href={`/admin/audit?q=${encodeURIComponent(auditQuery)}&page=${auditPage - 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Page {Math.min(auditPage, pageCount)} of {pageCount}
          </span>
          {auditPage < pageCount ? (
            <Link
              href={`/admin/audit?q=${encodeURIComponent(auditQuery)}&page=${auditPage + 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
async function RowAction({
  module,
  id,
  status,
  entity,
}: {
  module: string;
  id: string;
  status: string;
  actionValue?: string;
  secondary: string;
  detail: string;
  entity?: string;
}) {
  const ops = await getTranslations("admin.ops");
  // The inquiries branch is gone with the module: its four-status dropdown
  // predated SAMPLE_SENT/DELIVERED and let an Admin pick transitions the
  // database rejects. Status changes now go through the Lead Inbox.
  const config =
    module === "offers"
      ? {
          entity: "offers",
          options: [
            "ARRIVING_SOON",
            "NEW_ARRIVAL",
            "IN_STORE",
            "DISCOUNT",
            "SOLD_OUT",
            "INACTIVE",
          ],
        }
      : module === "content"
        ? {
            entity: "content",
            options: ["DRAFT", "PUBLISHED", "ARCHIVED"],
          }
        : null;
  const archiveEntity = entity ?? module;
  const canArchive = [
    "products",
    "offers",
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
    "articles",
    "article_categories",
    "media",
    "content",
  ].includes(archiveEntity);
  return (
    <div className="flex flex-wrap gap-2">
      {config ? (
        <AdminActionForm
          action={updateWorkflowStatusAction}
          submitLabel={ops("save")}
          className="flex gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="entity" value={config.entity} />
          <select
            name="status"
            defaultValue={status}
            aria-label={ops("status")}
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
          >
            {config.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </AdminActionForm>
      ) : null}
      {canArchive && status !== "deleted" && status !== "inactive" ? (
        <AdminActionForm
          action={archiveAdminRecordAction}
          submitLabel={ops("archive")}
          danger
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="entity" value={archiveEntity} />
        </AdminActionForm>
      ) : null}
    </div>
  );
}
