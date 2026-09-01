import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, ShieldBan } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { searchAdminUsers, type AdminUserSearch } from "@/lib/data/admin-users";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

const readParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

/**
 * Search, filter and pagination state lives entirely in the URL and is applied
 * by the database, not by JavaScript over a full fetch. That keeps a page link
 * shareable between Administrators, keeps the result set bounded, and means
 * the "no results" case is a real database answer rather than a client filter.
 */
function parseSearch(query: Record<string, string | string[] | undefined>) {
  const blocked = readParam(query.blocked);
  const search: AdminUserSearch = {
    emailQuery: readParam(query.email) || undefined,
    nameQuery: readParam(query.name) || undefined,
    blockedFilter:
      blocked === "blocked" ? true : blocked === "active" ? false : undefined,
    page: Math.max(1, Number.parseInt(readParam(query.page) || "1", 10) || 1),
  };
  return { search, blocked };
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/users">) {
  const { locale } = (await params) as { locale: Locale };
  const query = await searchParams;
  const t = await getTranslations("admin.users");
  const { search, blocked } = parseSearch(query);
  // The read path runs its own `requireAdmin()`; the layout's guard is not
  // treated as sufficient for a data function (FR-024).
  const result = await searchAdminUsers(search);

  const numberFormat = new Intl.NumberFormat(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  // Every pagination link carries the active search forward, so paging never
  // silently widens the result set.
  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (search.emailQuery) qs.set("email", search.emailQuery);
    if (search.nameQuery) qs.set("name", search.nameQuery);
    if (blocked) qs.set("blocked", blocked);
    if (page > 1) qs.set("page", String(page));
    const query = qs.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
  };

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <form
        method="get"
        className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
      >
        <label className="text-sm font-bold">
          {t("searchEmail")}
          <input
            type="search"
            name="email"
            dir="ltr"
            defaultValue={search.emailQuery ?? ""}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          {t("searchName")}
          <input
            type="search"
            name="name"
            defaultValue={search.nameQuery ?? ""}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          {t("statusFilter")}
          <select
            name="blocked"
            defaultValue={blocked}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">{t("filterAll")}</option>
            <option value="active">{t("filterActive")}</option>
            <option value="blocked">{t("filterBlocked")}</option>
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
              <tr className="border-b border-border text-start">
                <th className="p-4 text-start font-bold">{t("colName")}</th>
                <th className="p-4 text-start font-bold">{t("colContact")}</th>
                <th className="p-4 text-start font-bold">
                  {t("colRegistered")}
                </th>
                <th className="p-4 text-start font-bold">{t("colActivity")}</th>
                <th className="p-4 text-start font-bold">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4 align-top">
                    <Link
                      href={`/admin/users/${row.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {row.fullName || t("unnamed")}
                    </Link>
                    {row.companyName ? (
                      <span className="mt-1 block text-muted-foreground">
                        {row.companyName}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 align-top">
                    <span className="block" dir="ltr">
                      {row.email}
                    </span>
                    {row.phone ? (
                      <span
                        className="mt-1 block text-muted-foreground"
                        dir="ltr"
                      >
                        {row.phone}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 align-top whitespace-nowrap">
                    {dateFormat.format(new Date(row.registeredAt))}
                  </td>
                  <td className="p-4 align-top whitespace-nowrap text-muted-foreground">
                    {t("activitySummary", {
                      favorites: numberFormat.format(row.favoritesCount),
                      inquiries: numberFormat.format(row.inquiriesCount),
                    })}
                  </td>
                  <td className="p-4 align-top">
                    <span className="flex flex-wrap gap-1.5">
                      <StatusPill
                        tone={row.emailVerified ? "positive" : "neutral"}
                        label={
                          row.emailVerified ? t("verified") : t("unverified")
                        }
                      />
                      {row.isBlocked ? (
                        <StatusPill
                          tone="negative"
                          label={t("blocked")}
                          icon={<ShieldBan className="size-3.5" />}
                        />
                      ) : null}
                    </span>
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

function StatusPill({
  tone,
  label,
  icon,
}: {
  tone: "positive" | "neutral" | "negative";
  label: string;
  icon?: React.ReactNode;
}) {
  const tones = {
    positive:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    neutral: "bg-muted text-muted-foreground border-border",
    negative: "bg-destructive/10 text-destructive border-destructive/20",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {icon}
      {label}
    </span>
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
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${className} opacity-40`}>
        {trailingIcon ? null : icon}
        {label}
        {trailingIcon ? icon : null}
      </span>
    );
  }
  return (
    <Link href={href} className={`${className} transition hover:border-gold`}>
      {trailingIcon ? null : icon}
      {label}
      {trailingIcon ? icon : null}
    </Link>
  );
}
