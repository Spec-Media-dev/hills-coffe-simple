import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/app-providers";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The `<html>`/`<body>` document is owned by the root layout; this segment
 * only establishes the locale context and shared providers.
 */
export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <NextIntlClientProvider locale={locale}>
      <AppProviders>{children}</AppProviders>
    </NextIntlClientProvider>
  );
}
