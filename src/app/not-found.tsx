import Link from "next/link";

/**
 * Global not-found boundary.
 *
 * Every real route lives under `app/[locale]`, which means Next.js cannot
 * resolve a locale for an unmatched URL and therefore cannot use the locale
 * layout here. The root layout still supplies `<html lang>`, so this only
 * needs to render the branded page body.
 */
export default function GlobalNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-page px-5 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="display-lg mt-5">This page is not available.</h1>
        <p className="mt-4 text-muted-foreground">
          The page you requested may have moved or is no longer published.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
