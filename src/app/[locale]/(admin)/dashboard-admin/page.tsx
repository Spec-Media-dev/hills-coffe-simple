import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AdminSignInForm } from "@/components/forms/auth-forms";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function DashboardAdminPage({
  params,
}: PageProps<"/[locale]/dashboard-admin">) {
  const { locale } = (await params) as { locale: Locale };
  const viewer = await getViewer();
  if (viewer?.role === "ADMIN") redirect(localizedPath(locale, "/admin"));
  const t = await getTranslations("auth");
  const actions = await getTranslations("actions");
  return (
    <AuthShell
      eyebrow={t("adminEyebrow")}
      title={t("adminTitle")}
      body={t("adminBody")}
      asideTitle={t("adminAsideTitle")}
      asideBody={t("adminAsideBody")}
    >
      {viewer ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {t("adminNoAccess")}
        </p>
      ) : null}
      <AdminSignInForm
        locale={locale}
        labels={{
          email: t("email"),
          password: t("password"),
          submit: actions("signin"),
        }}
      />
    </AuthShell>
  );
}
