import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/redirects";

/**
 * Legacy route. Profile editing now lives on the consolidated
 * `account/settings` page; this stub keeps existing bookmarks working.
 */
export default async function LegacyProfilePage({
  params,
}: PageProps<"/[locale]/account/profile">) {
  const { locale } = (await params) as { locale: Locale };
  permanentRedirect(localizedPath(locale, "/account/settings"));
}
