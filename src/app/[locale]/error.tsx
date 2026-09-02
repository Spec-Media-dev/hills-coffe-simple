"use client";

import { useTranslations } from "next-intl";

/**
 * Error boundary for the locale tree.
 *
 * `error` is deliberately not rendered. A server-side failure carries the
 * upstream code in its message, and Next.js only redacts that in production —
 * showing it would put a Postgres code on screen in development and teach the
 * wrong habit. The digest is enough to find the incident in the server log.
 *
 * The boundary renders inside `[locale]/layout.tsx`, so the client-side
 * message catalogue is available here the same as on any other page.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <main className="grid min-h-[70svh] place-items-center bg-page px-5 text-center">
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-5 text-4xl">{t("title")}</h1>
        <button
          onClick={reset}
          className="mt-8 min-h-11 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
