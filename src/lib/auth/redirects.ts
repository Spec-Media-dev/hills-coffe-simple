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
];
export function localizedPath(locale: Locale, path: string) {
  return locale === "ar" ? `/ar${path === "/" ? "" : path}` : path;
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
    value.startsWith("/\\")
  )
    return localizedPath(locale, fallback);
  const normalized = value.replace(/^\/en(?=\/|$)/, "");
  const withoutLocale = normalized.replace(/^\/ar(?=\/|$)/, "") || "/";
  return knownRoots.some((root) =>
    root === "/"
      ? withoutLocale === "/"
      : withoutLocale === root || withoutLocale.startsWith(`${root}/`),
  )
    ? localizedPath(locale, withoutLocale)
    : localizedPath(locale, fallback);
}
