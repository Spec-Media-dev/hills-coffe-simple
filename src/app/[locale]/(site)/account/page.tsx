import {
  Building2,
  Heart,
  Mail,
  MessageSquareText,
  Phone,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getInquiryLabels } from "@/lib/inquiries/labels";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";
import { requireVerifiedUser } from "@/lib/auth/session";
import { avatarInitials, getOwnAvatarUrl } from "@/lib/data/avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = (await params) as { locale: Locale };
  const viewer = await requireVerifiedUser();
  if (!viewer)
    redirect(
      localizedPath(
        locale,
        `/sign-in?next=${encodeURIComponent(localizedPath(locale, "/account"))}`,
      ),
    );

  const t = await getTranslations("account");
  const labels = await getInquiryLabels();
  const db = await createSupabaseServerClient();
  const avatarUrl = await getOwnAvatarUrl();

  // Every figure below is a real query scoped to this customer — no
  // placeholder or fabricated metric (FR-016). RLS is the backstop.
  const [favoritesResult, activeSamplesResult, recentResult] =
    await Promise.all([
      db
        .from("favorites")
        .select("coffee_id", { count: "exact", head: true })
        .eq("user_id", viewer.id),
      db
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", viewer.id)
        .eq("type", "SAMPLE_REQUEST")
        .neq("status", "CLOSED"),
      db
        .from("inquiries")
        .select("request_code,type,status,created_at")
        .eq("user_id", viewer.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const favoritesCount = favoritesResult.count ?? 0;
  const activeSamples = activeSamplesResult.count ?? 0;
  const recent = recentResult.data ?? [];

  const stats = [
    {
      key: "favorites",
      label: t("stats.favorites"),
      value: favoritesCount,
      href: "/account/favorites",
      icon: Heart,
    },
    {
      key: "activeSamples",
      label: t("stats.activeSamples"),
      value: activeSamples,
      href: "/account/requests",
      icon: MessageSquareText,
    },
  ] as const;

  return (
    <section className="section-space bg-page">
      <div className="site-container">
        <p className="eyebrow">{t("profile")}</p>
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-base font-bold text-gold-bright">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 object-cover"
                />
              ) : (
                <span aria-hidden="true">
                  {avatarInitials(viewer.fullName, viewer.email)}
                </span>
              )}
            </span>
            <div>
              <h1 className="display-lg">{t("title")}</h1>
              <p className="mt-2 text-muted-foreground">{t("intro")}</p>
            </div>
          </div>
          <Link
            href="/account/settings"
            className="inline-flex h-11 min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold"
          >
            {t("nav.settings")}
          </Link>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
            <div className="grid size-14 place-items-center rounded-full bg-primary text-gold-bright">
              <UserRound className="size-6" />
            </div>
            <dl className="mt-8 grid gap-5">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("name")}
                </dt>
                <dd className="mt-1 font-medium">{viewer.fullName || "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Mail className="size-3" />
                  {t("email")}
                </dt>
                <dd className="mt-1 font-medium" dir="ltr">
                  {viewer.email}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Phone className="size-3" />
                  {t("profileForm.phone")}
                </dt>
                <dd className="mt-1 font-medium" dir="ltr">
                  {viewer.phone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="size-3" />
                  {t("company")}
                </dt>
                <dd className="mt-1 font-medium">
                  {viewer.companyName ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <Link
                  key={stat.key}
                  href={stat.href}
                  className="rounded-2xl border border-border bg-card p-6 transition hover:border-gold"
                >
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">{stat.label}</p>
                    <stat.icon
                      className="size-5 text-gold"
                      aria-hidden="true"
                    />
                  </div>
                  <strong className="mt-5 block text-4xl">{stat.value}</strong>
                </Link>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">{t("stats.recent")}</h2>
                <Link
                  href="/account/requests"
                  className="text-xs font-bold text-highlight underline-offset-4 hover:underline"
                >
                  {t("viewRequests")}
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="mt-6 rounded-xl border border-input p-6 text-center text-sm text-muted-foreground">
                  {t("stats.noActivity")}
                </p>
              ) : (
                <ul className="mt-5 grid gap-3">
                  {recent.map((row) => (
                    <li key={row.request_code}>
                      <Link
                        href={`/account/requests/${row.request_code}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input px-4 py-3 text-sm transition hover:border-gold"
                      >
                        {/* Request codes stay LTR inside an RTL layout. */}
                        <span className="font-bold" dir="ltr">
                          {row.request_code}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {labels.status(row.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
