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
async function priceLadderIsValid(
  offerId: string,
  candidate: { id?: string; minBags: number; price: number },
) {
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("offer_price_tiers")
    .select("id,min_bags,price_per_kg_usd")
    .eq("offer_id", offerId);
  const tiers = (data ?? [])
    .filter((row) => row.id !== candidate.id)
    .map((row) => ({
      minBags: row.min_bags,
      price: Number(row.price_per_kg_usd),
    }));
  tiers.push({ minBags: candidate.minBags, price: candidate.price });
  tiers.sort((a, b) => a.minBags - b.minBags);
  return (
    new Set(tiers.map((tier) => tier.minBags)).size === tiers.length &&
    tiers.every(
      (tier, index) => index === 0 || tier.price <= tiers[index - 1].price,
    )
  );
}
export async function createAdminPriceTier(input: {
  offerId: string;
  minBags: number;
  price: number;
}) {
  if (
    !(await requireAdmin()) ||
    !(await priceLadderIsValid(input.offerId, input))
  )
    return false;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("offer_price_tiers").insert({
    offer_id: input.offerId,
    min_bags: input.minBags,
    price_per_kg_usd: input.price,
  });
  return !error;
}
export async function updateAdminPriceTier(input: {
  id: string;
  offerId: string;
  minBags: number;
  price: number;
}) {
  if (
    !(await requireAdmin()) ||
    !(await priceLadderIsValid(input.offerId, input))
  )
    return false;
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("offer_price_tiers")
    .update({ min_bags: input.minBags, price_per_kg_usd: input.price })
    .eq("id", input.id);
  return !error;
}
export async function deleteAdminPriceTier(tierId: string) {
  if (!(await requireAdmin())) return false;
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("offer_price_tiers")
    .delete()
    .eq("id", tierId);
  return !error;
}
