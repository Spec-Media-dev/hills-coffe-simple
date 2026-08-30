import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect(`/${locale}/sign-in?next=/${locale}/admin`);
  return (
    <div className="min-h-screen bg-page lg:flex">
      <AdminNav />
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-5 md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {locale === "ar" ? "مساحة الإدارة" : "Admin workspace"}
            </p>
            <p className="text-sm font-medium">{admin.name ?? admin.email}</p>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
