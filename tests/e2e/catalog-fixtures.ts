import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hasAuthFixtureCredentials,
  service,
  supabasePublicKey,
  supabaseProjectUrl,
} from "./auth-fixtures";

export { hasAuthFixtureCredentials, service };

/** A 1x1 PNG and a 1x1 JPEG, enough to exercise real magic-byte sniffing. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

/** Anything this run creates is namespaced so the owner can find it later. */
export const QA_PREFIX = "qa-p6";

export type CatalogAdmin = {
  id: string;
  email: string;
  password: string;
  cleanup: () => Promise<void>;
};

/**
 * A temporary Administrator for the Phase 6 catalog run.
 *
 * The catalog rows it creates are owner-approved QA data and deliberately
 * stay behind, but the account itself is a fixture and is removed. Because
 * `coffees.created_by` / `coffee_offers.updated_by` reference `profiles`,
 * those columns are cleared first — otherwise the delete fails on the foreign
 * key, exactly like `profiles.blocked_by` did in Phase 1 (finding N7).
 */
export async function createCatalogAdmin(label: string): Promise<CatalogAdmin> {
  if (!hasAuthFixtureCredentials)
    throw new Error("Auth fixture credentials are unavailable");

  const tag = `${label
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toLowerCase()}${Date.now().toString(36)}`;
  const email = `e2e-hills-p6-${tag}@example.com`;
  const password = `P6-Cat-${Math.random().toString(36).slice(2)}!Aa9`;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E P6 ${tag} admin`, phone: "+201000000000" },
  });
  if (error) throw new Error(`create catalog admin: ${error.message}`);
  const id = data.user.id;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (profile) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const { error: promoteError } = await service
    .from("profiles")
    .update({ role: "ADMIN" })
    .eq("id", id);
  if (promoteError) throw new Error(`promote: ${promoteError.message}`);

  return {
    id,
    email,
    password,
    cleanup: async () => {
      for (const [table, column] of [
        ["coffees", "created_by"],
        ["coffees", "updated_by"],
        ["coffee_offers", "created_by"],
        ["coffee_offers", "updated_by"],
        ["media", "uploaded_by"],
        ["origins", "created_by"],
        ["origins", "updated_by"],
        ["regions", "created_by"],
        ["regions", "updated_by"],
        ["site_settings", "updated_by"],
      ] as const) {
        await service
          .from(table)
          .update({ [column]: null })
          .eq(column, id);
      }
      await service.auth.admin.deleteUser(id);
    },
  };
}

/** A verified customer, used to prove the protected-price entitlement. */
export async function createCatalogCustomer(kind: "verified" | "blocked") {
  const tag = `${kind}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-hills-p6c-${tag}@example.com`;
  const password = `P6-Cus-${Math.random().toString(36).slice(2)}!Aa9`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E P6 ${tag}`, phone: "+201000000000" },
  });
  if (error) throw new Error(`create customer: ${error.message}`);
  const id = data.user.id;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (profile) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    id,
    email,
    password,
    cleanup: async () => {
      await service.from("profiles").update({ blocked_by: null }).eq("id", id);
      await service.auth.admin.deleteUser(id);
    },
  };
}

/** Signs in an admin client so a test can block a customer through the RPC. */
export async function adminClientFor(admin: CatalogAdmin) {
  const client: SupabaseClient = createClient(
    supabaseProjectUrl,
    supabasePublicKey,
    { auth: { persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) throw new Error(`admin sign-in: ${error.message}`);
  return client;
}
