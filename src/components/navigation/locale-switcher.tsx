"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const nextLocale = locale === "en" ? "ar" : "en";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="flex h-10 items-center gap-2 rounded-full border border-border bg-background/70 px-3 text-xs font-bold uppercase tracking-wider transition hover:border-gold hover:text-gold"
      aria-label={nextLocale === "ar" ? "العربية" : "English"}
    >
      <Languages className="size-4" />
      <span>{nextLocale}</span>
    </button>
  );
}
