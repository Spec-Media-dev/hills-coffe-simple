import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { requireAdmin } from "@/lib/auth/session";
import { localizedPath } from "@/lib/auth/redirects";
import type { Locale } from "@/i18n/routing";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = (await params) as { locale: Locale };
  const admin = await requireAdmin();
  if (!admin) redirect(localizedPath(locale, "/dashboard-admin"));
  const t = await getTranslations("admin");
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
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
