"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Switching locale performs a FULL DOCUMENT NAVIGATION, not an App Router
 * client transition. Phase 0 reproduced three defects caused by the previous
 * `router.replace(pathname, { locale })` soft navigation:
 *
 *  - React logged "Encountered a script tag while rendering React component"
 *    because the transition re-rendered the JSON-LD `<script type="application/
 *    ld+json">` on the client, where React will not execute script tags.
 *  - `<html lang>` and `<html dir>` went stale: the root layout owns them and a
 *    soft navigation does not re-render it, so Arabic rendered LTR under
 *    `lang="en"` until a manual reload.
 *  - The query string was dropped, because only `pathname` was passed.
 *
 * A document navigation fixes all three at the source rather than suppressing
 * the symptom: the server re-renders the root layout, so `lang`/`dir` come from
 * the proxy's locale header, and the structured data is emitted as part of a
 * fresh HTML document instead of being reconciled on the client.
 *
 * This is rendered as a real anchor so it stays keyboard- and
 * middle-click-friendly and still works without JavaScript. The `href` carries
 * the localized pathname; the click handler re-adds `search` and `hash`, which
 * are read from `window.location` rather than `useSearchParams()` so that
 * placing this component in a shared header does not opt every page out of
 * static rendering.
 *
 * `replace` (not `assign`) preserves the previous switcher's history behavior.
 */
export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const nextLocale: Locale = locale === "en" ? "ar" : "en";
  const target = getPathname({ href: pathname, locale: nextLocale });

  return (
    <a
      href={target}
      hrefLang={nextLocale}
      lang={nextLocale}
      onClick={(event) => {
        // Leave modified clicks (new tab/window) to the browser.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        const { search, hash } = window.location;
        window.location.replace(`${target}${search}${hash}`);
      }}
      className="flex h-10 items-center gap-2 rounded-full border border-border bg-background/70 px-3 text-xs font-bold uppercase tracking-wider transition hover:border-gold hover:text-gold"
      aria-label={nextLocale === "ar" ? "العربية" : "English"}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{nextLocale}</span>
    </a>
  );
}
