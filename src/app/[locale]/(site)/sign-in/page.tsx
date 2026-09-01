import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/forms/auth-forms";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};
export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = (await params) as { locale: Locale };
  const query = await searchParams;
  const t = await getTranslations("auth");
  const actions = await getTranslations("actions");
  const responses = await getTranslations("auth.responses");
  const notice =
    query.reset === "success"
      ? responses("passwordUpdated")
      : query.error === "blocked"
        ? responses("blocked")
        : query.error === "link_expired"
          ? responses("linkExpired")
          : query.error === "access_denied"
            ? responses("customerAccessDenied")
            : null;
  return (
    <AuthShell
      eyebrow={actions("signin")}
      title={t("signinTitle")}
      body={t("signinBody")}
      asideTitle={t("verifyTitle")}
      asideBody={t("verifyBody")}
    >
      {notice ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium"
        >
          {notice}
        </p>
      ) : null}
      <SignInForm
        locale={locale}
        next={typeof query.next === "string" ? query.next : undefined}
        labels={{
          email: t("email"),
          password: t("password"),
          submit: actions("signin"),
        }}
      />
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="font-bold text-highlight">
          {t("forgot")}
        </Link>
        <span>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-bold">
            {t("create")}
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
