import { getTranslations } from "next-intl/server";

/**
 * Shown the moment a search is submitted, while the results render on the
 * server. It mirrors the real page's structure (green header band, then result
 * cards) so the content arrives in place instead of the layout jumping.
 */
export default async function SearchLoading() {
  const t = await getTranslations("search");
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <section className="border-b border-border bg-primary py-12 md:py-16">
        <div className="site-container max-w-5xl animate-pulse">
          <div className="h-3 w-24 rounded-full bg-white/15" />
          <div className="mt-6 h-12 w-3/4 max-w-xl rounded-xl bg-white/12" />
          <div className="mt-8 h-12 max-w-2xl rounded-full bg-white/10" />
        </div>
      </section>
      <section className="section-space-tight">
        <div className="site-container grid max-w-5xl animate-pulse gap-4">
          <div className="h-3 w-20 rounded-full bg-muted" />
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="flex gap-5 rounded-2xl border border-border bg-card p-5"
            >
              <div className="size-20 shrink-0 rounded-xl bg-muted sm:size-28" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="h-6 w-2/3 rounded-lg bg-muted" />
                <div className="h-3 w-1/2 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
