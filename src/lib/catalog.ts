import "server-only";
import { coffees } from "@/data/coffees";
import { getProtectedPrice } from "@/data/private-pricing";
import type { CatalogCoffee, Viewer } from "@/data/types";
import { serializeCatalog } from "@/lib/catalog-policy";

export function catalogForViewer(viewer: Viewer | null): CatalogCoffee[] {
  return serializeCatalog(coffees, viewer, getProtectedPrice);
}
