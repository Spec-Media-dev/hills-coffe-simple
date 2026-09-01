import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import type { Locale } from "@/i18n/routing";
import { hasRecoveryMarker } from "@/lib/auth/recovery";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};
export default async function ResetPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("auth");
  const recovery = await hasRecoveryMarker();
  return (
    <AuthShell
      eyebrow={t("resetTitle")}
      title={t("newPassword")}
      body={t("resetBody")}
      asideTitle={t("verifyTitle")}
      asideBody={t("verifyBody")}
    >
      {recovery ? (
        <ResetPasswordForm
          locale={locale}
          labels={{
            password: t("newPassword"),
            confirmPassword: t("confirmNewPassword"),
            submit: t("updatePassword"),
          }}
        />
      ) : (
        <p
          role="alert"
          className="rounded-xl border border-border bg-card p-5 text-sm"
        >
          {t("responses.recoveryRequired")}{" "}
          <Link href="/forgot-password" className="font-bold text-highlight">
            {t("forgot")}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
