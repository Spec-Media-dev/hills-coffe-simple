import "server-only";
import { requireAdmin, requireVerifiedUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getProtectedPriceTiers(offerIds: string[]) {
  const viewer = await requireVerifiedUser();
  if (!viewer || !isSupabaseConfigured() || offerIds.length === 0)
    return new Map<string, { minBags: number; pricePerKgUsd: number }[]>();
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("offer_price_tiers")
    .select("offer_id,min_bags,price_per_kg_usd")
    .in("offer_id", offerIds)
    .order("min_bags");
  if (error)
    throw new Error(`Pricing unavailable (${error.code ?? "upstream"})`);
  const result = new Map<
    string,
    { minBags: number; pricePerKgUsd: number }[]
  >();
  for (const row of data ?? [])
    result.set(row.offer_id, [
      ...(result.get(row.offer_id) ?? []),
      { minBags: row.min_bags, pricePerKgUsd: Number(row.price_per_kg_usd) },
    ]);
  return result;
}

export async function getAdminPriceTiers() {
  if (!(await requireAdmin())) return [];
  const db = await createSupabaseServerClient();
  const [tiersQ, offersQ] = await Promise.all([
    db
      .from("offer_price_tiers")
      .select("id,offer_id,min_bags,price_per_kg_usd")
      .order("offer_id")
      .order("min_bags"),
    db.from("coffee_offers").select("id,reference_number"),
  ]);
  const references = new Map(
    (offersQ.data ?? []).map((offer) => [offer.id, offer.reference_number]),
  );
  return (tiersQ.data ?? []).map((tier) => ({
    id: tier.id,
    offerId: tier.offer_id,
    reference: references.get(tier.offer_id) ?? tier.offer_id,
    minBags: tier.min_bags,
    price: Number(tier.price_per_kg_usd),
  }));
}
/* `createAdminPriceTier` / `updateAdminPriceTier` / `deleteAdminPriceTier`
 * and their shared ladder check were removed in Phase 6. The ladder rules
 * (unique `min_bags`, price never rising with volume) now live in
 * `src/actions/admin-catalog.ts`, where each violation can be attributed to
 * the field the Admin has to change instead of collapsing into one boolean.
 * This module keeps only the price *reads*. */
