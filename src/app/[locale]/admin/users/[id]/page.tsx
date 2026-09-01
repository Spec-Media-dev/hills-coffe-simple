import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldBan } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { UserBlockControl } from "@/components/admin/user-block-control";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";
import { avatarInitials } from "@/lib/data/avatar";
import {
  getAdminCustomerAvatarUrl,
  getAdminUserDetail,
} from "@/lib/data/admin-users";

export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};

/**
 * Read-only customer detail.
 *
 * The only write this page offers is block/unblock. There is deliberately no
 * avatar upload, replace or delete control, and no role editor: an Admin may
 * look at a customer's avatar but never write `avatar_path` or the storage
 * object (FR-020), and role is never editable from the customer directory.
 */
export default async function AdminUserDetailPage({
  params,
}: PageProps<"/[locale]/admin/users/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const admin = await requireAdmin();
  if (!admin) notFound();

  const t = await getTranslations("admin.users");
  const customer = await getAdminUserDetail(id);
  // A non-customer id (including another Administrator) is a 404, not a
  // "forbidden" — the directory must not confirm that an account exists.
  if (!customer) notFound();

  const avatarUrl = await getAdminCustomerAvatarUrl(
    customer.id,
    customer.avatarPath,
  );
  const numberFormat = new Intl.NumberFormat(locale);
  const dateTimeFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: t("colName"), value: customer.fullName || t("unnamed") },
    { label: t("email"), value: customer.email, ltr: true },
    { label: t("phone"), value: customer.phone || t("none"), ltr: true },
    { label: t("company"), value: customer.companyName || t("none") },
    {
      label: t("colRegistered"),
      value: dateFormat.format(new Date(customer.registeredAt)),
    },
    {
      label: t("verification"),
      value: customer.emailVerified ? t("verified") : t("unverified"),
    },
  ];

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/users"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("backToList")}
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-5">
        {/* Read-only presentation. The signed URL is minted server-side and
            expires; no control on this page can write it. */}
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-lg font-bold text-gold-bright">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={t("avatarAlt", { name: customer.fullName })}
              width={80}
              height={80}
              unoptimized
              className="size-20 object-cover"
            />
          ) : (
            <span aria-hidden="true">
              {avatarInitials(customer.fullName, customer.email)}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl md:text-4xl">
            {customer.fullName || t("unnamed")}
          </h1>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {customer.emailVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {t("verified")}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                {t("unverified")}
              </span>
            )}
            {customer.isBlocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
                <ShieldBan className="size-3.5" aria-hidden="true" />
                {t("blocked")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="ms-auto">
          <UserBlockControl
            userId={customer.id}
            isBlocked={customer.isBlocked}
            customerName={customer.fullName || customer.email}
          />
        </div>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("detailsTitle")}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {fact.label}
                </dt>
                <dd
                  className="mt-1 break-words"
                  dir={fact.ltr ? "ltr" : undefined}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("activityTitle")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-5">
              <strong className="block text-3xl tabular-nums">
                {numberFormat.format(customer.favoritesCount)}
              </strong>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("favorites")}
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <strong className="block text-3xl tabular-nums">
                {numberFormat.format(customer.inquiriesCount)}
              </strong>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("requests")}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("activityHint")}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-7 xl:col-span-2">
          <h2 className="text-xl">{t("accessTitle")}</h2>
          {customer.isBlocked ? (
            <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-5">
              <p className="font-bold text-destructive">{t("blockedNotice")}</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("blockedAt")}
                  </dt>
                  <dd className="mt-1">
                    {customer.blockedAt
                      ? dateTimeFormat.format(new Date(customer.blockedAt))
                      : t("none")}
                  </dd>
                </div>
                <div>
                  {/* Internal, Admin-only. Never rendered on any customer
                      surface. */}
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("blockReason")}
                  </dt>
                  <dd className="mt-1 break-words">
                    {customer.blockReason || t("noReason")}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              {t("activeNotice")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
