import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusPill, TypeBadge } from "@/components/admin/lead-badges";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  LEAD_STATUSES,
  LEAD_TYPES,
  listLeadInbox,
} from "@/lib/data/lead-inbox";
import { getInquiryLabels } from "@/lib/inquiries/labels";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

const readParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";

/**
 * P7-T03 — the Admin Lead Inbox.
 *
 * Search, type/status filters and pagination live in the URL and are applied
 * by the database (`listLeadInbox`), never by JavaScript over a full-table
 * read: the result set stays bounded however many requests exist, and a
 * filtered view is a link one Administrator can send another.
 */
export default async function AdminLeadInboxPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/inquiries">) {
  const { locale } = (await params) as { locale: Locale };
  const query = await searchParams;
  const t = await getTranslations("admin.leads");
  const labels = await getInquiryLabels();

  const search = readParam(query.q);
  const type = readParam(query.type);
  const status = readParam(query.status);
  const page = Math.max(
    1,
    Number.parseInt(readParam(query.page) || "1", 10) || 1,
  );

  // The read path runs its own `requireAdmin()`; the Admin layout's guard is
  // not treated as sufficient for a data function.
  const result = await listLeadInbox({ query: search, type, status, page });

  const numberFormat = new Intl.NumberFormat(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  // Paging carries the active search and filters forward, so moving between
  // pages can never silently widen the result set.
  const pageHref = (next: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (type) qs.set("type", type);
    if (status) qs.set("status", status);
    if (next > 1) qs.set("page", String(next));
    const encoded = qs.toString();
    return encoded ? `/admin/inquiries?${encoded}` : "/admin/inquiries";
  };

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <form
        method="get"
        className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-end"
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
          {t("typeFilter")}
          <select
            name="type"
            defaultValue={type}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">{t("allTypes")}</option>
            {LEAD_TYPES.map((value) => (
              <option key={value} value={value}>
                {labels.type(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          {t("statusFilter")}
          <select
            name="status"
            defaultValue={status}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">{t("allStatuses")}</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {labels.status(value)}
              </option>
            ))}
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

      {result.rows.length ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-start font-bold">{t("colCode")}</th>
                <th className="p-4 text-start font-bold">{t("colType")}</th>
                <th className="p-4 text-start font-bold">{t("colCustomer")}</th>
                <th className="p-4 text-start font-bold">{t("colCoffee")}</th>
                <th className="p-4 text-start font-bold">{t("colStatus")}</th>
                <th className="p-4 text-start font-bold">{t("colCreated")}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4 align-top">
                    {/* A request code is an identifier: LTR inside RTL. */}
                    <Link
                      href={`/admin/inquiries/${row.id}`}
                      dir="ltr"
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {row.requestCode}
                    </Link>
                  </td>
                  <td className="p-4 align-top">
                    <TypeBadge type={row.type} label={labels.type(row.type)} />
                  </td>
                  <td className="p-4 align-top">
                    <span className="block">{row.customerName}</span>
                    <span
                      className="mt-1 block text-muted-foreground"
                      dir="ltr"
                    >
                      {row.customerEmail}
                    </span>
                  </td>
                  <td className="p-4 align-top">
                    <span className="block">{row.coffeeName || t("none")}</span>
                    {row.warehouseCode ? (
                      <span
                        className="mt-1 block text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {row.warehouseCode}
                        {row.offerReference ? ` · ${row.offerReference}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 align-top">
                    <StatusPill
                      status={row.status}
                      label={labels.status(row.status)}
                    />
                  </td>
                  <td className="p-4 align-top whitespace-nowrap">
                    {dateFormat.format(new Date(row.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {result.configured ? t("noResults") : t("notConfigured")}
        </p>
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
            // Logical direction: the chevrons mirror automatically in RTL.
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
