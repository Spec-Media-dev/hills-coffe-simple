import { getTranslations } from "next-intl/server";
import { forgotPasswordAction } from "@/actions/auth";
import { AuthField, AuthShell } from "@/components/auth/auth-shell";

export default async function ForgotPage({
  params,
  searchParams,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthShell
      eyebrow={t("forgot")}
      title={t("resetTitle")}
      body={t("resetBody")}
      asideTitle={
        locale === "ar"
          ? "عودة آمنة إلى حسابك."
          : "A secure route back to your account."
      }
      asideBody={
        locale === "ar"
          ? "تدير Supabase روابط الاستعادة والجلسة المؤقتة عند الاتصال."
          : "Supabase manages recovery links and temporary sessions once connected."
      }
    >
      <form action={forgotPasswordAction} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        <AuthField
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
        />
        {query.sent && (
          <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {locale === "ar"
              ? "تحقق من بريدك لرابط الاستعادة."
              : "Check your inbox for the recovery link."}
          </p>
        )}
        {query.error && (
          <p className="rounded-xl bg-gold/10 p-3 text-sm">{t("config")}</p>
        )}
        <button className="h-12 rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {t("sendLink")}
        </button>
      </form>
    </AuthShell>
  );
}
