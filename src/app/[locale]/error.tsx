"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-page px-5 text-center">
      <div>
        <p className="eyebrow">Error</p>
        <h1 className="mt-5 text-4xl">We could not load this page.</h1>
        <button
          onClick={reset}
          className="mt-8 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
