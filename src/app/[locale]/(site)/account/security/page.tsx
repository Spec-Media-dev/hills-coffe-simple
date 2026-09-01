import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";

/**
 * Legacy route. Email and password controls now live on the consolidated
 * `account/settings` page; this stub keeps existing bookmarks working.
 */
export default async function LegacySecurityPage({
  params,
}: PageProps<"/[locale]/account/security">) {
  const { locale } = (await params) as { locale: Locale };
  permanentRedirect(localizedPath(locale, "/account/settings"));
}
