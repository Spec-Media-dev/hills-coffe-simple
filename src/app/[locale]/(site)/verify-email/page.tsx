import type { Metadata } from "next";
import { BadgeCheck, MailCheck, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/actions/auth";
import { VerifyEmailForm } from "@/components/forms/verify-email-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

/** Shows only the masked local part so the page never exposes a full address
 * that the visitor did not already supply. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${local.length > 2 ? "•".repeat(Math.min(local.length - 2, 6)) : ""}@${domain}`;
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = (await params) as { locale: Locale };
  const query = await searchParams;
  const viewer = await getViewer();

  // An already-verified visitor should never see a fake waiting state.
  if (viewer?.emailVerified)
    redirect(
      localizedPath(locale, viewer.role === "ADMIN" ? "/admin" : "/account"),
    );

  const t = await getTranslations("auth.verify");
  const actions = await getTranslations("actions");
  const expired = query.error === "link_expired";
  const requested = typeof query.email === "string" ? query.email : undefined;
  const email = requested ?? viewer?.email;

  return (
    <section className="section-space bg-page">
      <div className="site-container max-w-2xl">
        <div className="rounded-[2rem] border border-border bg-card p-7 shadow-[var(--shadow-soft)] md:p-12">
          {expired ? (
            <TriangleAlert className="size-12 text-destructive" />
          ) : (
            <MailCheck className="size-12 text-highlight" />
          )}
          <p className="eyebrow mt-8">{t("eyebrow")}</p>
          <h1 className="display-lg mt-4">
            {expired ? t("expiredTitle") : t("title")}
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
            {expired ? t("expiredBody") : t("body")}
          </p>

          {email ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-page px-4 py-2 text-sm font-bold">
              <MailCheck className="size-4 text-highlight" />
              <span dir="ltr">{maskEmail(email)}</span>
            </p>
          ) : null}

          <div className="mt-6 rounded-xl border border-input bg-page p-5">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-highlight" />
              <span>{t("registeredNotVerified")}</span>
            </p>
          </div>

          <div className="mt-8">
            <VerifyEmailForm locale={locale} email={email} />
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-border pt-7 text-sm">
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground transition hover:bg-forest-light"
            >
              {t("signInCta")}
            </Link>
            {viewer ? (
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <button className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 font-bold transition hover:border-gold">
                  {actions("signout")}
                </button>
              </form>
            ) : (
              <Link
                href="/sign-up"
                className="font-bold text-highlight underline-offset-4 hover:underline"
              >
                {t("changeEmail")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
