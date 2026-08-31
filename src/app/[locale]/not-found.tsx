import Link from "next/link";

/**
 * Rendered for any `notFound()` inside the locale tree.
 *
 * This boundary deliberately avoids next-intl's `Link`/translation helpers:
 * a not-found boundary can render without the locale request context, and
 * throwing here makes Next.js fall back to its unbranded error document.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-page px-5 text-center">
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
