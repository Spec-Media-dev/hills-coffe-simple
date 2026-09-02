import type { Locale } from "@/i18n/routing";
import type { OfferStatus } from "@/lib/supabase/types.generated";

const continentLabels: Record<string, string> = {
  Africa: "أفريقيا",
  Asia: "آسيا",
  Europe: "أوروبا",
  "North America": "أمريكا الشمالية",
  Oceania: "أوقيانوسيا",
  "South America": "أمريكا الجنوبية",
};

export function publicContinentLabel(continent: string | null, locale: Locale) {
  if (!continent) return "—";
  return locale === "ar"
    ? (continentLabels[continent] ?? continent)
    : continent;
}

export function publicOfferStatusKey(status: OfferStatus) {
  return `status${status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}` as
    | "statusArrivingSoon"
    | "statusNewArrival"
    | "statusInStore"
    | "statusDiscount"
    | "statusSoldOut"
    | "statusInactive";
}
