import { getTranslations } from "next-intl/server";
import { signInAction } from "@/actions/auth";
import { AuthField, AuthShell } from "@/components/auth/auth-shell";
import { Link } from "@/i18n/navigation";

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("auth");
  const actions = await getTranslations("actions");
  return (
    <AuthShell
      eyebrow={actions("signin")}
      title={t("signinTitle")}
      body={t("signinBody")}
      asideTitle={
        locale === "ar"
          ? "الأسعار تبقى بينك وبين فريق القهوة."
          : "Pricing stays between you and the coffee team."
      }
      asideBody={
        locale === "ar"
          ? "تُرسل الأسعار فقط بعد التحقق من جلسة العميل على الخادم."
          : "Protected values are only attached after the customer session is verified on the server."
      }
    >
      <form action={signInAction} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        <input
          type="hidden"
          name="next"
          value={typeof query.next === "string" ? query.next : ""}
        />
        <AuthField
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
        />
        <AuthField
          label={t("password")}
          name="password"
          type="password"
          autoComplete="current-password"
        />
        {query.error && (
          <p className="rounded-xl bg-gold/10 p-3 text-sm">
            {query.error === "config"
              ? t("config")
              : locale === "ar"
                ? "تحقق من البيانات وحاول مرة أخرى."
                : "Check your details and try again."}
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="font-bold text-gold">
            {t("forgot")}
          </Link>
          <span className="text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/sign-up" className="font-bold text-foreground">
              {t("create")}
            </Link>
          </span>
        </div>
        <button className="h-12 rounded-full bg-primary text-sm font-bold text-primary-foreground transition hover:bg-forest-light">
          {actions("signin")}
        </button>
      </form>
    </AuthShell>
  );
}
