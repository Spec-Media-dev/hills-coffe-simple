import { getTranslations } from "next-intl/server";
import { updatePasswordAction } from "@/actions/auth";
import { AuthField, AuthShell } from "@/components/auth/auth-shell";

export default async function ResetPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthShell
      eyebrow={t("resetTitle")}
      title={t("newPassword")}
      body={t("resetBody")}
      asideTitle={locale === "ar" ? "خطوة أخيرة." : "One final step."}
      asideBody={
        locale === "ar"
          ? "اختر كلمة مرور قوية وفريدة لهذا الحساب."
          : "Choose a strong password unique to this account."
      }
    >
      <form action={updatePasswordAction} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        <AuthField
          label={t("newPassword")}
          name="password"
          type="password"
          autoComplete="new-password"
        />
        {query.error && (
          <p className="rounded-xl bg-gold/10 p-3 text-sm">
            {locale === "ar"
              ? "تعذر تحديث كلمة المرور."
              : "The password could not be updated."}
          </p>
        )}
        <button className="h-12 rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {t("updatePassword")}
        </button>
      </form>
    </AuthShell>
  );
}
