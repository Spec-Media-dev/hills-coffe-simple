import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { toggleFavoriteAction } from "@/actions/account";
import { OfferCard } from "@/components/catalog/offer-card";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import { getOfferList } from "@/lib/data/catalog";
import { Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Favourites",
  robots: { index: false, follow: false },
};

export default async function FavoritesPage({
  params,
}: PageProps<"/[locale]/account/favorites">) {
  const { locale } = await params;
  const viewer = await getViewer();
  if (!viewer) return null;
  const db = await createSupabaseServerClient();
  const [{ data }, catalog] = await Promise.all([
    db.from("favorites").select("coffee_id").eq("user_id", viewer.id),
    getOfferList(locale as Locale),
  ]);
  const ids = new Set((data ?? []).map((x) => x.coffee_id));
  const offers = [
    ...new Map(
      catalog.offers
        .filter((x) => ids.has(x.coffeeId))
        .map((x) => [x.coffeeId, x]),
    ).values(),
  ];
  const t = await getTranslations("account.favorites");
  const catalogT = await getTranslations("catalog");
  const actionsT = await getTranslations("actions");
  const labels = {
    bags: catalogT("bags"),
    pricing: actionsT("pricing"),
    view: actionsT("view"),
    remove: t("remove"),
  };
  return (
    <section className="site-container section-space">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4">{t("title")}</h1>
      {offers.length ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((item) => (
            <div key={item.coffeeId}>
              <OfferCard item={item} labels={labels} />
              <form action={toggleFavoriteAction} className="mt-2">
                <input type="hidden" name="coffeeId" value={item.coffeeId} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/${locale}/account/favorites`}
                />
                <button className="w-full rounded-full border border-border py-2 text-xs font-bold">
                  {labels.remove}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <Heart className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-5 font-bold">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Link
            href="/green-coffee-offer-list"
            className="mt-7 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
          >
            {t("emptyCta")}
          </Link>
        </div>
      )}
    </section>
  );
}
