import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmFragment } from "@/components/auth/confirm-fragment";
import { DocumentRedirect } from "@/components/auth/document-redirect";
import type { Locale } from "@/i18n/routing";
import { assertSafeRedirect, localizedPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Continue",
  robots: { index: false, follow: false },
};

export default async function AuthContinuePage({
  params,
  searchParams,
}: PageProps<"/[locale]/continue">) {
  const { locale } = (await params) as { locale: Locale };
  const { next, mode } = await searchParams;
  const destination = assertSafeRedirect(next, locale, "/");

  // `mode=confirm` means /auth/callback received a callback with nothing the
  // server could exchange, which is what an implicit-flow Supabase
  // confirmation looks like: the session is in the URL fragment, and a
  // fragment never reaches the server. Only the browser can read it.
  if (mode === "confirm")
    return (
      <ConfirmFragment
        next={destination}
        failurePath={localizedPath(locale, "/verify-email?error=link_expired")}
        settlePath="/auth/callback"
      />
    );

  const actions = await getTranslations("actions");
  return <DocumentRedirect to={destination} label={actions("continue")} />;
}
