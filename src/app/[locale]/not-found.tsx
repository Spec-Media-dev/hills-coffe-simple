import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

/**
 * Rendered for any `notFound()` inside the locale tree.
 *
 * The locale is read from the header the proxy sets, exactly as the root
 * layout reads it, rather than from next-intl's request context: a not-found
 * boundary can render without that context, and throwing here would make
 * Next.js fall back to its unbranded error document. Passing an explicit
 * locale to `getTranslations` keeps the page translated without that risk.
 *
 * next-intl's `Link` is avoided for the same reason; `localePrefix` is
 * "as-needed", so the Arabic home is `/ar` and the English home is `/`.
 */
export default async function NotFound() {
  const requested = (await headers()).get("x-next-intl-locale");
  const locale = routing.locales.includes(
    requested as (typeof routing.locales)[number],
  )
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <main className="grid min-h-[70svh] place-items-center bg-page px-5 text-center">
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
