import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignOutControl } from "@/components/auth/sign-out-control";
import { AvatarForm } from "@/components/forms/avatar-form";
import {
  ChangeEmailForm,
  ChangePasswordForm,
  ProfileForm,
} from "@/components/forms/account-forms";
import type { Locale } from "@/i18n/routing";
import { AVATAR_MIME_TYPES } from "@/lib/avatar";
import { localizedPath } from "@/lib/auth/redirects";
import { requireVerifiedUser } from "@/lib/auth/session";
import { avatarInitials, getOwnAvatarUrl } from "@/lib/data/avatar";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

/**
 * Consolidates what used to live on `account/profile` and `account/security`
 * into the master plan's single `account/settings` route. Both old URLs remain
 * reachable as redirects so bookmarks keep working.
 */
export default async function AccountSettingsPage({
  params,
}: PageProps<"/[locale]/account/settings">) {
  const { locale } = (await params) as { locale: Locale };
  // The account layout already enforces the full customer gate; repeating it
  // here keeps the page safe if it is ever mounted outside that layout.
  const viewer = await requireVerifiedUser();
  if (!viewer) redirect(localizedPath(locale, "/sign-in"));

  const avatarUrl = await getOwnAvatarUrl();
  const t = await getTranslations("account.settings");
  const profile = await getTranslations("account.profileForm");
  const security = await getTranslations("account.security");
  const actions = await getTranslations("actions");
  const account = await getTranslations("account");

  return (
    <section className="site-container section-space">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <div className="mt-10 grid gap-6">
        <section
          aria-labelledby="settings-photo"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <h2 id="settings-photo" className="text-xl font-bold">
            {t("photoHeading")}
          </h2>
          <div className="mt-6">
            <AvatarForm
              locale={locale}
              currentUrl={avatarUrl}
              initials={avatarInitials(viewer.fullName, viewer.email)}
              accept={AVATAR_MIME_TYPES.join(",")}
              labels={{
                heading: t("photoHeading"),
                hint: t("photoHint"),
                choose: t("photoChoose"),
                upload: t("photoUpload"),
                remove: t("photoRemove"),
                current: t("photoCurrent"),
                none: t("photoNone"),
              }}
            />
          </div>
        </section>

        <section
          aria-labelledby="settings-profile"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <h2 id="settings-profile" className="text-xl font-bold">
            {profile("title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile("intro")}
          </p>
          <div className="mt-6">
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
                fullName: viewer.fullName ?? "",
                phone: viewer.phone ?? "",
                companyName: viewer.companyName ?? "",
                address: viewer.address ?? "",
                countryCode: viewer.countryCode ?? "",
              }}
            />
          </div>
        </section>

        <section
          aria-labelledby="settings-email"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <h2 id="settings-email" className="text-xl font-bold">
            {security("emailTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {security("emailIntro")}
          </p>
          <div className="mt-6">
            <ChangeEmailForm
              locale={locale}
              currentEmail={viewer.email}
              labels={{
                email: security("newEmail"),
                submit: security("updateEmail"),
              }}
            />
          </div>
        </section>

        <section
          aria-labelledby="settings-password"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <h2 id="settings-password" className="text-xl font-bold">
            {security("passwordTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {security("passwordIntro")}
          </p>
          <div className="mt-6">
            <ChangePasswordForm
              locale={locale}
              labels={{
                currentPassword: security("currentPassword"),
                newPassword: security("newPassword"),
                confirmPassword: security("confirmPassword"),
                updatePassword: security("updatePassword"),
              }}
            />
          </div>
        </section>
        <section
          aria-labelledby="settings-session"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <h2 id="settings-session" className="text-xl font-bold">
            {security("sessionTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {security("sessionIntro")}
          </p>
          <div className="mt-6">
            <SignOutControl
              locale={locale}
              labels={{
                signOut: actions("signout"),
                confirmTitle: account("signOut.title"),
                confirmBody: account("signOut.body"),
                cancel: actions("cancel"),
              }}
            />
          </div>
        </section>
      </div>
    </section>
  );
}
