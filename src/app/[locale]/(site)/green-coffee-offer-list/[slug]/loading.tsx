import { getTranslations } from "next-intl/server";

/**
 * Instant structure for a coffee page while it renders on the server: the
 * same page ground and two-column hero proportions, with no invented values.
 * It is also what a `Link` prefetch can fetch ahead of a click on this
 * dynamic route, so opening a coffee from search or the catalog responds
 * immediately.
 */
export default async function CoffeeLoading() {
  const t = await getTranslations("search");
  return (
    <section
      aria-busy="true"
      className="overflow-hidden border-b border-border bg-page"
    >
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <div className="site-container grid animate-pulse gap-10 py-10 md:py-20 lg:grid-cols-2 lg:items-center">
        <div className="aspect-[4/3] rounded-2xl bg-muted" />
        <div className="space-y-5">
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="h-14 w-4/5 rounded-xl bg-muted" />
          <div className="h-4 w-3/5 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-16 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
