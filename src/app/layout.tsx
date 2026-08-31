import type { Metadata, Viewport } from "next";
import { Cairo, Manrope, Readex_Pro } from "next/font/google";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { canonicalUrl } from "@/lib/env";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
});
const readex = Readex_Pro({
  subsets: ["arabic"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: canonicalUrl,
  title: {
    default: "Hills Coffee | Green Coffee, Closer",
    template: "%s | Hills Coffee",
  },
  description:
    "Hills Coffee is a B2B green coffee supplier sourcing specialty and commercial lots for roasters, with stock held in our Egypt and Dubai warehouses.",
  keywords:
    "green coffee supplier, wholesale green coffee, specialty green coffee, arabica sourcing, robusta sourcing",
  openGraph: {
    title: "Hills Coffee | B2B Green Coffee Supplier",
    description:
      "Specialty and commercial green coffee sourcing for roasters, supplied from Egypt and Dubai.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEE4D1" },
    { media: "(prefers-color-scheme: dark)", color: "#173C32" },
  ],
};

/**
 * The document lives here rather than in `app/[locale]/layout.tsx` so that
 * error and not-found boundaries — which Next.js cannot resolve a locale for —
 * still render inside a real `<html lang>` document instead of the unstyled
 * framework fallback.
 *
 * The locale comes from the header our proxy sets while rewriting unprefixed
 * English paths, so it stays correct for both `/` and `/ar/...` requests.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requested = (await headers()).get("x-next-intl-locale");
  const locale = routing.locales.includes(
    requested as (typeof routing.locales)[number],
  )
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={`${manrope.variable} ${cairo.variable} ${readex.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
