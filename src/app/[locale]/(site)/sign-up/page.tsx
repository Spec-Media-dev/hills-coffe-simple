import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/forms/auth-forms";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: true },
};
export default async function SignUpPage({
  params,
}: PageProps<"/[locale]/sign-up">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("auth");
  const actions = await getTranslations("actions");
  return (
    <AuthShell
      eyebrow={t("create")}
      title={t("signupTitle")}
      body={t("signupBody")}
      asideTitle={t("verifyTitle")}
      asideBody={t("verifyBody")}
    >
      <SignUpForm
        locale={locale}
        labels={{
          fullName: t("name"),
          email: t("email"),
          phone: t("phone"),
          companyName: t("companyOptional"),
          password: t("password"),
          confirmPassword: t("confirmPassword"),
          submit: t("create"),
        }}
      />
      <p className="mt-5 text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/sign-in" className="font-bold text-foreground">
          {actions("signin")}
        </Link>
      </p>
    </AuthShell>
  );
}
