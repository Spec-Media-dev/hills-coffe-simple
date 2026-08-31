import type { Metadata } from "next";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import {
  ChangeEmailForm,
  ChangePasswordForm,
  ProfileForm,
} from "@/components/forms/account-forms";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin account",
  robots: { index: false, follow: false },
};

export default async function AdminAccountPage({
  params,
}: PageProps<"/[locale]/admin/account">) {
  const { locale } = (await params) as { locale: Locale };
  // The admin layout already enforces the ADMIN role; this keeps the page
  // safe if it is ever rendered outside that layout.
  const admin = await requireAdmin();
  if (!admin) return null;
  const t = await getTranslations("admin.account");
  const profile = await getTranslations("account.profileForm");
  const security = await getTranslations("account.security");
  const actions = await getTranslations("actions");

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 shrink-0 text-highlight" />
            <div className="min-w-0">
              <p className="truncate font-bold" dir="ltr">
                {admin.email}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("roleAdmin")}
              </p>
            </div>
            {admin.emailVerified ? (
              <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="size-3.5" />
                {security("verified")}
              </span>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("sessionTitle")}</h2>
          <p className="mt-2 mb-5 text-sm text-muted-foreground">
            {t("sessionIntro")}
          </p>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="inline-flex h-12 min-h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-bold transition hover:border-gold">
              {actions("signout")}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("detailsTitle")}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            {t("detailsIntro")}
          </p>
          <ProfileForm
            locale={locale}
            labels={{
              name: profile("name"),
              phone: profile("phone"),
              company: profile("company"),
              address: profile("address"),
              country: profile("country"),
              countryHint: profile("countryHint"),
              save: profile("save"),
            }}
            defaults={{
              fullName: admin.fullName ?? "",
              phone: admin.phone ?? "",
              companyName: admin.companyName ?? "",
              address: admin.address ?? "",
              countryCode: admin.countryCode ?? "",
            }}
          />
        </section>

        <section className="grid gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
            <h2 className="text-xl">{security("emailTitle")}</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              {security("emailIntro")}
            </p>
            <ChangeEmailForm
              locale={locale}
              currentEmail={admin.email}
              labels={{
                newEmail: security("newEmail"),
                emailHint: security("emailHint"),
                updateEmail: security("updateEmail"),
              }}
            />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
            <h2 className="text-xl">{security("passwordTitle")}</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              {security("passwordIntro")}
            </p>
            <ChangePasswordForm
              locale={locale}
              labels={{
                currentPassword: security("currentPassword"),
                newPassword: security("newPassword"),
                confirmPassword: security("confirmPassword"),
                passwordHint: security("passwordHint"),
                updatePassword: security("updatePassword"),
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
