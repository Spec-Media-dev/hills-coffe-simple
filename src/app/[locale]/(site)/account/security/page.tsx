import type { Metadata } from "next";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import {
  ChangeEmailForm,
  ChangePasswordForm,
} from "@/components/forms/account-forms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

export default async function SecurityPage({
  params,
}: PageProps<"/[locale]/account/security">) {
  const { locale } = (await params) as { locale: Locale };
  // The account layout already guarantees an authenticated viewer.
  const viewer = await getViewer();
  if (!viewer) return null;
  const t = await getTranslations("account.security");
  const actions = await getTranslations("actions");
  return (
    <section className="site-container section-space">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <div className="mt-10 grid gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {viewer.emailVerified ? (
                <BadgeCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="size-5 shrink-0 text-destructive" />
              )}
              <div>
                <p className="font-bold" dir="ltr">
                  {viewer.email}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {viewer.emailVerified ? t("verified") : t("unverified")}
                </p>
              </div>
            </div>
            {viewer.emailVerified ? null : (
              <Link
                href={`/verify-email?email=${encodeURIComponent(viewer.email)}`}
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold"
              >
                {t("verifyCta")}
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-2xl">{t("emailTitle")}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            {t("emailIntro")}
          </p>
          <ChangeEmailForm
            locale={locale}
            currentEmail={viewer.email}
            labels={{
              newEmail: t("newEmail"),
              emailHint: t("emailHint"),
              updateEmail: t("updateEmail"),
            }}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-2xl">{t("passwordTitle")}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            {t("passwordIntro")}
          </p>
          <ChangePasswordForm
            locale={locale}
            labels={{
              currentPassword: t("currentPassword"),
              newPassword: t("newPassword"),
              confirmPassword: t("confirmPassword"),
              passwordHint: t("passwordHint"),
              updatePassword: t("updatePassword"),
            }}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-2xl">{t("sessionTitle")}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            {t("sessionIntro")}
          </p>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="inline-flex h-12 min-h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-bold transition hover:border-gold">
              {actions("signout")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
