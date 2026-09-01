import type { Locale } from "@/i18n/routing";

const knownRoots = [
  "/",
  "/account",
  "/green-coffee-offer-list",
  "/coffee-origins",
  "/knowledge",
  "/contact",
  "/request-a-quote",
  "/about",
  "/admin",
  "/dashboard-admin",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
export function localizedPath(locale: Locale, path: string) {
  return locale === "ar" ? `/ar${path === "/" ? "" : path}` : path;
}

/**
 * Server Actions run under an internal `[locale]` rewrite. Hop through a
 * Route Handler so the browser performs a fresh canonical document request
 * instead of applying an incomplete client-side route tree.
 */
export function actionRedirectPath(locale: Locale, path: string) {
  // The `/${locale}/…` form is deliberate. A Server Action redirect is applied
  // by the App Router *client*, whose route tree is the internally-rewritten
  // one; asking it for the canonical `/continue` yields a client-side 404.
  // Targeting `/en/continue` forces the proxy's 308, which makes the browser
  // perform a fresh canonical document request that resolves correctly.
  return `/${locale}/continue?next=${encodeURIComponent(path)}`;
}
export function assertSafeRedirect(
  value: unknown,
  locale: Locale,
  fallback = "/account",
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return localizedPath(locale, fallback);

  let parsed: URL;
  try {
    parsed = new URL(value, "https://redirect.hills.invalid");
  } catch {
    return localizedPath(locale, fallback);
  }
  if (parsed.origin !== "https://redirect.hills.invalid")
    return localizedPath(locale, fallback);

  const normalized = parsed.pathname.replace(/^\/en(?=\/|$)/, "");
  const withoutLocale = normalized.replace(/^\/ar(?=\/|$)/, "") || "/";
  const allowed = knownRoots.some((root) =>
    root === "/"
      ? withoutLocale === "/"
      : withoutLocale === root || withoutLocale.startsWith(`${root}/`),
  );
  return allowed
    ? `${localizedPath(locale, withoutLocale)}${parsed.search}${parsed.hash}`
    : localizedPath(locale, fallback);
}
