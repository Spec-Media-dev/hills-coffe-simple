import { Building2, Mail, MessageSquareText, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { getViewer } from "@/lib/auth/session";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in?next=/${locale}/account`);
  const t = await getTranslations("account");
  const actions = await getTranslations("actions");
  return (
    <section className="section-space bg-page">
      <div className="site-container">
        <p className="eyebrow">{t("profile")}</p>
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="display-lg">{t("title")}</h1>
            <p className="mt-4 text-muted-foreground">{t("intro")}</p>
          </div>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="h-11 rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold">
              {actions("signout")}
            </button>
          </form>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
            <div className="grid size-14 place-items-center rounded-full bg-primary text-gold-bright">
              <UserRound className="size-6" />
            </div>
            <dl className="mt-8 grid gap-5">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {locale === "ar" ? "الاسم" : "Name"}
                </dt>
                <dd className="mt-1 font-medium">{viewer.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Mail className="size-3" />
                  {locale === "ar" ? "البريد الإلكتروني" : "Email"}
                </dt>
                <dd className="mt-1 font-medium">{viewer.email}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="size-3" />
                  {locale === "ar" ? "الشركة" : "Company"}
                </dt>
                <dd className="mt-1 font-medium">{viewer.company ?? "—"}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">{t("inquiries")}</p>
                <h2 className="mt-3 text-3xl">
                  {locale === "ar"
                    ? "محادثات المحاصيل"
                    : "Product conversations"}
                </h2>
              </div>
              <MessageSquareText className="size-6 text-gold" />
            </div>
            <div className="mt-12 rounded-xl border border-dashed border-input py-14 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
