import { getTranslations } from "next-intl/server";
import { signUpAction } from "@/actions/auth";
import { AuthField, AuthShell } from "@/components/auth/auth-shell";
import { Link } from "@/i18n/navigation";

export default async function SignUpPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("auth");
  const actions = await getTranslations("actions");
  return (
    <AuthShell
      eyebrow={t("create")}
      title={t("signupTitle")}
      body={t("signupBody")}
      asideTitle={
        locale === "ar"
          ? "مسار عميل واحد، من الاختيار إلى الاستفسار."
          : "One customer journey, from selection to inquiry."
      }
      asideBody={
        locale === "ar"
          ? "وصول محمي للأسعار وتجربة شراء احترافية واضحة من البداية."
          : "Protected price access and a clear professional buying experience from day one."
      }
    >
      <form action={signUpAction} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField label={t("name")} name="name" autoComplete="name" />
          <AuthField
            label={t("company")}
            name="company"
            autoComplete="organization"
          />
        </div>
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
          autoComplete="new-password"
        />
        {query.error && (
          <p className="rounded-xl bg-gold/10 p-3 text-sm">
            {query.error === "config"
              ? t("config")
              : locale === "ar"
                ? "راجع البيانات وحاول مرة أخرى."
                : "Review your details and try again."}
          </p>
        )}
        <div className="text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/sign-in" className="font-bold text-foreground">
            {actions("signin")}
          </Link>
        </div>
        <button className="h-12 rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {t("create")}
        </button>
      </form>
    </AuthShell>
  );
}
