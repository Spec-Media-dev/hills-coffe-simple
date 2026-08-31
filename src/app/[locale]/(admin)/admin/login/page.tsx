import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";

// Legacy admin entry. The canonical admin sign-in route is /dashboard-admin.
export default async function LegacyAdminLoginPage({
  params,
}: PageProps<"/[locale]/admin/login">) {
  const { locale } = (await params) as { locale: Locale };
  permanentRedirect(localizedPath(locale, "/dashboard-admin"));
}
