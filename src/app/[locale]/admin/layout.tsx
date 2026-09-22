import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { Link } from "@/i18n/navigation";
import { avatarInitials, getOwnAvatarUrl } from "@/lib/data/avatar";
import { requireAdmin } from "@/lib/auth/session";
import { localizedPath } from "@/lib/auth/redirects";
import type { Locale } from "@/i18n/routing";

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

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = (await params) as { locale: Locale };
  const admin = await requireAdmin();
  if (!admin) redirect(localizedPath(locale, "/admin/login"));
  const t = await getTranslations("admin");
  const avatarUrl = await getOwnAvatarUrl();
  return (
    <div className="min-h-dvh bg-page lg:flex lg:items-start">
      <AdminNav />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-8">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("workspace")}
            </p>
            <p className="truncate text-sm font-medium">
              {admin.fullName || admin.email}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
            <Link
              href="/admin/account"
              aria-label={t("account.title")}
              className="grid h-11 min-h-11 w-11 place-items-center rounded-full border border-border bg-card p-1 transition hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-9 overflow-hidden rounded-full bg-primary text-xs font-bold text-gold-bright">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 object-cover"
                  />
                ) : (
                  <span className="grid size-9 place-items-center" aria-hidden="true">
                    {avatarInitials(admin.fullName, admin.email)}
                  </span>
                )}
              </span>
            </Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
