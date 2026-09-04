import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSiteLogo } from "@/lib/data/site-logo";

/**
 * Shell for the Admin entry routes (`/dashboard-admin`, legacy `/admin/login`).
 *
 * These pages previously sat in the `(site)` group, so the Admin sign-in screen
 * rendered inside the public marketing header and footer. This group exists to
 * take them out of that chrome while keeping them under `[locale]`, so locale
 * and the provider stack still resolve exactly once, in `[locale]/layout.tsx`.
 *
 * The bar is deliberately minimal: it carries the brand mark plus the theme
 * and locale controls that the site header used to provide, and its 73px
 * height matches the offset `AuthShell` subtracts from the viewport.
 *
 * Phase 8 added the mark. Taking these pages out of the public chrome had also
 * taken the logo off the Admin sign-in screen, which was the one entry point
 * with no branding at all (§21).
 */

/**
 * Private area: never indexed, and its links never followed.
 *
 * Declared on the layout so every page beneath inherits it — several of them
 * had no directive of their own. Anonymous visitors are already redirected
 * before any of this renders, and robots.txt disallows the paths, but a URL can
 * still be indexed from an external link without ever being fetched. The meta
 * directive is the layer that answers that case.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminEntryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = await getTranslations("brand");
  const logo = await getSiteLogo((await getLocale()) as Locale);
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed start-4 top-4 z-[100] rounded-md bg-background px-4 py-3 font-bold focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="flex h-[72px] items-center justify-between gap-2 border-b border-border bg-background px-5 md:px-8">
        <Link
          href="/"
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark height={36} label={brand("logoAlt")} logo={logo} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <main id="main-content">{children}</main>
    </>
  );
}
