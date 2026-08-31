import "server-only";
import type { Locale } from "@/i18n/routing";
import type { ContentLocale } from "@/lib/supabase/types.generated";

export type TranslationRow = { locale: ContentLocale };
export function pickTranslation<T extends TranslationRow>(
  rows: T[],
  locale: Locale,
) {
  const translation =
    rows.find((row) => row.locale === locale) ??
    rows.find((row) => row.locale === "en") ??
    null;
  return {
    translation,
    fallback: Boolean(translation && translation.locale !== locale),
  };
}
export function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows)
    map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}
export function storagePublicUrl(base: string, bucket: string, path: string) {
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}
export function monthLabel(month: number, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, month - 1, 1)));
}
