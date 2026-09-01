import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hasAuthFixtureCredentials,
  service,
  supabasePublicKey,
  supabaseProjectUrl,
} from "./auth-fixtures";

export { hasAuthFixtureCredentials };

export type AdminUsersPersona = {
  id: string;
  email: string;
  password: string;
  fullName: string;
};

export type AdminUsersFixtureSet = {
  /** Unique to this run; every fixture's name contains it, so a name search
   *  isolates them from anything else living in the database. */
  tag: string;
  admin: AdminUsersPersona;
  /** A second Administrator, to prove Admin-target blocking is impossible. */
  otherAdmin: AdminUsersPersona;
  customers: AdminUsersPersona[];
  /** The customer that starts out blocked, for the blocked filter. */
  blocked: AdminUsersPersona;
  /** Customer whose avatar object exists, for the read-only avatar view. */
  withAvatar: AdminUsersPersona;
  isBlocked: (id: string) => Promise<boolean>;
  blockReasonOf: (id: string) => Promise<string | null>;
  cleanup: () => Promise<void>;
};

/** More than one page at the workspace's 20-row page size. */
const CUSTOMER_COUNT = 21;

/** A 1x1 PNG. */
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (character) => character.charCodeAt(0),
);

/**
 * Real Supabase fixtures for the Phase 5 Admin Users workspace.
 *
 * Accounts are created through the Auth Admin API with `email_confirm: true`,
 * which provisions confirmed accounts without sending any email, and they are
 * created concurrently so that seeding a full second page of results stays
 * fast enough to run in the standard suite.
 *
 * Nothing here ever touches a real customer account: every fixture carries a
 * per-run tag in both its address and its name.
 */
export async function createAdminUsersFixtureSet(
  label: string,
): Promise<AdminUsersFixtureSet> {
  if (!hasAuthFixtureCredentials)
    throw new Error("Auth fixture credentials are unavailable");

  const tag = `p5${label
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toLowerCase()}${Date.now().toString(36)}`;
  const password = `P5-Fx-${Math.random().toString(36).slice(2)}!Aa9`;
  const created: AdminUsersPersona[] = [];

  // Role is applied after creation, once the provisioning trigger has written
  // the profile row, so `createPersona` only creates the account.
  async function createPersona(name: string): Promise<AdminUsersPersona> {
    const email = `e2e-hills-${tag}-${name}@example.com`;
    const fullName = `E2E ${tag} ${name}`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: "+201000000000" },
    });
    if (error) throw new Error(`create ${name}: ${error.message}`);
    const persona = { id: data.user.id, email, password, fullName };
    created.push(persona);
    return persona;
  }

  const [admin, otherAdmin, ...customers] = await Promise.all([
    createPersona("admin"),
    createPersona("second-admin"),
    ...Array.from({ length: CUSTOMER_COUNT }, (_unused, index) =>
      createPersona(`customer-${String(index).padStart(2, "0")}`),
    ),
  ]);

  // The profile-provisioning trigger is asynchronous; wait for every row once
  // rather than sleeping per account.
  const ids = created.map((persona) => persona.id);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data } = await service.from("profiles").select("id").in("id", ids);
    if ((data?.length ?? 0) === ids.length) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { error: promoteError } = await service
    .from("profiles")
    .update({ role: "ADMIN" })
    .in("id", [admin.id, otherAdmin.id]);
  if (promoteError) throw new Error(`promote: ${promoteError.message}`);

  // One customer starts blocked, so the blocked filter has something real to
  // find. The block goes through the approved RPC on an Admin session, never
  // by writing the protected columns directly.
  const adminClient: SupabaseClient = createClient(
    supabaseProjectUrl,
    supabasePublicKey,
    { auth: { persistSession: false } },
  );
  const { error: signInError } = await adminClient.auth.signInWithPassword({
    email: admin.email,
    password,
  });
  if (signInError) throw new Error(`fixture admin: ${signInError.message}`);

  const blocked = customers[0];
  const { error: blockError } = await adminClient.rpc(
    "admin_set_user_blocked",
    {
      target_user_id: blocked.id,
      blocked: true,
      reason: `E2E ${tag} seeded block`,
    },
  );
  if (blockError) throw new Error(`seed block: ${blockError.message}`);

  const withAvatar = customers[1];
  const avatarPath = `${withAvatar.id}/avatar.png`;
  await service.storage
    .from("avatars")
    .upload(avatarPath, TINY_PNG, { contentType: "image/png", upsert: true });
  await service
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", withAvatar.id);

  return {
    tag,
    admin,
    otherAdmin,
    customers,
    blocked,
    withAvatar,
    isBlocked: async (id) => {
      const { data } = await service
        .from("profiles")
        .select("is_blocked")
        .eq("id", id)
        .maybeSingle();
      return Boolean(data?.is_blocked);
    },
    blockReasonOf: async (id) => {
      const { data } = await service
        .from("profiles")
        .select("block_reason")
        .eq("id", id)
        .maybeSingle();
      return data?.block_reason ?? null;
    },
    cleanup: async () => {
      await adminClient.auth.signOut();
      await service.storage.from("avatars").remove([avatarPath]);
      // `profiles.blocked_by` points at an Administrator, so customers must be
      // removed before the Admins that blocked them.
      const customersFirst = created.filter(
        (persona) => persona.id !== admin.id && persona.id !== otherAdmin.id,
      );
      // Deleted concurrently to keep teardown well inside the hook budget.
      await Promise.all(
        customersFirst.map((persona) =>
          service.auth.admin.deleteUser(persona.id),
        ),
      );
      await service.auth.admin.deleteUser(otherAdmin.id);
      await service.auth.admin.deleteUser(admin.id);
    },
  };
}

/**
 * A single Administrator, for suites that only need one signed-in Admin (the
 * settings-independence checks) and must not pay for a full directory seed.
 */
export async function createAdminPersona(label: string): Promise<{
  admin: AdminUsersPersona;
  currentPassword: () => string;
  setPassword: (next: string) => void;
  profileOf: (id: string) => Promise<Record<string, unknown> | null>;
  siteSetting: (column: string) => Promise<unknown>;
  cleanup: () => Promise<void>;
}> {
  if (!hasAuthFixtureCredentials)
    throw new Error("Auth fixture credentials are unavailable");

  const tag = `p5s${label
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toLowerCase()}${Date.now().toString(36)}`;
  let password = `P5-St-${Math.random().toString(36).slice(2)}!Aa9`;
  const email = `e2e-hills-${tag}-admin@example.com`;
  const fullName = `E2E ${tag} settings admin`;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: "+201000000000" },
  });
  if (error) throw new Error(`create settings admin: ${error.message}`);
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
    admin: { id, email, password, fullName },
    currentPassword: () => password,
    setPassword: (next) => {
      password = next;
    },
    profileOf: async (target) => {
      const { data: row } = await service
        .from("profiles")
        .select("full_name,phone,company_name,address,country_code,role")
        .eq("id", target)
        .maybeSingle();
      return row ?? null;
    },
    siteSetting: async (column) => {
      const { data: row } = await service
        .from("site_settings")
        .select(column)
        .limit(1)
        .maybeSingle();
      return (row as Record<string, unknown> | null)?.[column];
    },
    cleanup: async () => {
      await service.auth.admin.deleteUser(id);
    },
  };
}
