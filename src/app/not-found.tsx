import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

/**
 * Global not-found boundary.
 *
 * Every real route lives under `app/[locale]`, so Next.js cannot resolve a
 * locale for an unmatched URL and cannot use the locale layout here. The
 * locale therefore comes from the header the proxy sets, the same source the
 * root layout uses for `<html lang>` — which keeps the copy and the language
 * attribute agreeing with each other on a URL that matched no route.
 */
export default async function GlobalNotFound() {
  const requested = (await headers()).get("x-next-intl-locale");
  const locale = routing.locales.includes(
    requested as (typeof routing.locales)[number],
  )
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-5 text-center">
      <div>
        <p className="eyebrow">{t("notFoundEyebrow")}</p>
        <h1 className="display-lg mt-5">{t("notFoundTitle")}</h1>
        <p className="mt-4 text-muted-foreground">{t("notFoundBody")}</p>
        <Link
          href={locale === routing.defaultLocale ? "/" : `/${locale}`}
          className="mt-8 inline-flex h-12 min-h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
        >
          {t("returnHome")}
        </Link>
      </div>
    </main>
  );
}
