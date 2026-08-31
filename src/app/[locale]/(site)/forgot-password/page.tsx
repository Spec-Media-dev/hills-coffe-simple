import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailActionForm } from "@/components/forms/auth-forms";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};
export default async function ForgotPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("auth");
  return (
    <AuthShell
      eyebrow={t("forgot")}
      title={t("resetTitle")}
      body={t("resetBody")}
      asideTitle={t("verifyTitle")}
      asideBody={t("verifyBody")}
    >
      <EmailActionForm
        locale={locale}
        mode="forgot"
        labels={{ email: t("email"), submit: t("sendLink") }}
      />
    </AuthShell>
  );
}
