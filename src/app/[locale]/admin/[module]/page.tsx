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
  createCmsPageAction,
  deletePriceTierAction,
  savePriceTierAction,
  updateWorkflowStatusAction,
} from "@/actions/admin-operations";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminModuleForm } from "@/components/admin/admin-module-form";
import { OfferPicker } from "@/components/admin/offer-picker";

const modules = [
  "products",
  "offers",
  "inquiries",
  "pricing",
  "origins",
  "taxonomy",
  "users",
  "content",
  "settings",
  "regions",
  "warehouses",
  "media",
  "articles",
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
  const [rows, options, settings] = await Promise.all([
    getAdminModuleRows(module, locale as Locale),
    getAdminFormOptions(locale as Locale),
    module === "settings" ? getAdminSiteSettings() : Promise.resolve(null),
  ]);
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
      {module === "pricing" ? (
        <AdminActionForm
          action={savePriceTierAction}
          submitLabel={ops("addTier")}
          className="mt-7 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_.5fr_.5fr_auto]"
        >
          <OfferPicker offers={options.offers} />
          <input
            name="minBags"
            required
            type="number"
            min="1"
            placeholder="Min bags"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <input
            name="price"
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="USD / kg"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          />
        </AdminActionForm>
      ) : null}
      {module === "content" ? (
        <AdminActionForm
          action={createCmsPageAction}
          submitLabel={ops("createDraft")}
          className="mt-7 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input
            name="pageKey"
            required
            placeholder="page-key"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <input
            name="routePath"
            required
            placeholder="/route-path"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <select
            name="template"
            className="h-11 rounded-lg border border-input bg-background px-3"
          >
            <option>STANDARD</option>
            <option>COMMERCIAL</option>
            <option>SEGMENT</option>
            <option>PRICING</option>
            <option>LEGAL</option>
            <option>SUPPORT</option>
          </select>
        </AdminActionForm>
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
                  "content",
                  "products",
                  "offers",
                  "origins",
                  "regions",
                  "warehouses",
                  "varieties",
                  "articles",
                  "article-categories",
                  "taxonomy",
                  "media",
                ].includes(module) ? (
                  <Link
                    href={
                      module === "content"
                        ? `/admin/content/${row.id}`
                        : `/admin/${module}/${row.id}${
                            module === "taxonomy" && row.entity
                              ? `?entity=${row.entity}`
                              : ""
                          }`
                    }
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
  actionValue,
  secondary,
  detail,
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
  if (module === "pricing" && actionValue)
    return (
      <div className="flex flex-wrap gap-2">
        <AdminActionForm
          action={savePriceTierAction}
          submitLabel={ops("save")}
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="offerId" value={actionValue} />
          <input
            name="minBags"
            type="number"
            min="1"
            defaultValue={secondary}
            aria-label="Minimum bags"
            className="h-11 w-20 rounded-lg border border-input bg-background px-2 text-xs"
          />
          <input
            name="price"
            type="number"
            min=".01"
            step=".01"
            defaultValue={detail}
            aria-label="Price per kilogram"
            className="h-11 w-24 rounded-lg border border-input bg-background px-2 text-xs"
          />
        </AdminActionForm>
        <AdminActionForm
          action={deletePriceTierAction}
          submitLabel={ops("delete")}
          danger
        >
          <input type="hidden" name="id" value={id} />
        </AdminActionForm>
      </div>
    );
  const config =
    module === "inquiries"
      ? {
          entity: "inquiries",
          options: ["NEW", "RECEIVED", "CONTACTED", "CLOSED"],
        }
      : module === "offers"
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
