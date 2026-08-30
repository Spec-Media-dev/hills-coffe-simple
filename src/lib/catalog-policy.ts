import type { CatalogCoffee, Coffee, Viewer } from "@/data/types";

type PriceLookup = (
  offerId: string,
) => { amount: number; currency: string } | null;

export function serializeCatalog(
  coffees: Coffee[],
  viewer: Viewer | null,
  lookup: PriceLookup,
): CatalogCoffee[] {
  return coffees.map((coffee) => ({
    ...coffee,
    offers: coffee.offers.map((offer) => {
      const protectedPrice = viewer ? lookup(offer.id) : null;
      return {
        ...offer,
        price: protectedPrice
          ? `${protectedPrice.currency} ${protectedPrice.amount.toFixed(2)} / kg`
          : null,
      };
    }),
  }));
}
