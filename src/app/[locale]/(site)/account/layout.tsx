import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";
import { getViewer } from "@/lib/auth/session";
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  const viewer = await getViewer();
  if (!viewer)
    redirect(
      localizedPath(
        locale,
        `/sign-in?next=${encodeURIComponent(localizedPath(locale, "/account"))}`,
      ),
    );
  const t = await getTranslations("account.nav");
  const links = [
    ["/account", t("overview")],
    ["/account/profile", t("profile")],
    ["/account/favorites", t("favorites")],
    ["/account/requests", t("requests")],
    ["/account/security", t("security")],
  ] as const;
  return (
    <div className="bg-page">
      <div className="site-container flex gap-2 overflow-x-auto border-b border-border py-4">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-bold"
          >
            {label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
