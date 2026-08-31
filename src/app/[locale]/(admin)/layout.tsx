import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";

/**
 * Shell for the Admin entry routes (`/dashboard-admin`, legacy `/admin/login`).
 *
 * These pages previously sat in the `(site)` group, so the Admin sign-in screen
 * rendered inside the public marketing header and footer. This group exists to
 * take them out of that chrome while keeping them under `[locale]`, so locale
 * and the provider stack still resolve exactly once, in `[locale]/layout.tsx`.
 *
 * The bar is deliberately minimal: it carries only the theme and locale
 * controls that the site header used to provide, and its 73px height matches
 * the offset `AuthShell` subtracts from the viewport.
 */
export default function AdminEntryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed start-4 top-4 z-[100] rounded-md bg-background px-4 py-3 font-bold focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="flex h-[72px] items-center justify-end gap-2 border-b border-border bg-background px-5 md:px-8">
        <ThemeToggle />
        <LocaleSwitcher />
      </header>
      <main id="main-content">{children}</main>
    </>
  );
}
