/**
 * Staging fixture lifecycle for the Phase 1 authorization-contract tests.
 *
 * These tests talk to the real Supabase project, because Constitution
 * Principle XIV requires database authorization to be proven by behavior
 * rather than by reading policy text. They are therefore excluded from the
 * default hermetic `npm test` run and executed via `npm run test:integration`.
 *
 * Fixtures are created through the Auth Admin API with `email_confirm: true`,
 * which provisions a confirmed account WITHOUT sending any email, and are
 * deleted again in `cleanupFixtures()`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

export type Role = "USER" | "ADMIN";

function loadEnv(): Record<string, string> {
  const merged: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      merged[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through to process.env (CI supplies the values directly)
  }
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (process.env[k]) merged[k] = process.env[k] as string;
  }
  return merged;
}

const env = loadEnv();

/** The env var may carry a `/rest/v1/` suffix; supabase-js needs the bare origin. */
function projectUrl(raw: string): string {
  const u = new URL(raw);
  u.pathname = "/";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

export const hasStagingCredentials = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL &&
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const SUPABASE_URL = hasStagingCredentials
  ? projectUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  : "";

/** Service-role client. Bypasses RLS entirely and has NO `auth.uid()`. */
export const service: SupabaseClient = hasStagingCredentials
  ? createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : (null as unknown as SupabaseClient);

/** Unauthenticated client, exactly what a public visitor gets. */
export const anon: SupabaseClient = hasStagingCredentials
  ? createClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    })
  : (null as unknown as SupabaseClient);

export type Fixture = {
  id: string;
  email: string;
  role: Role;
  client: SupabaseClient;
};

const FIXTURE_PASSWORD = `P1-Fx-${Math.random().toString(36).slice(2)}!Aa9`;
const runTag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const registry: Fixture[] = [];

/**
 * Creates a confirmed fixture account and returns a signed-in client for it.
 *
 * An ADMIN fixture is required for any admin-guarded RPC: the service-role key
 * has no `auth.uid()`, so `is_admin()` is false for it and every admin RPC
 * refuses it with `admin_access_required` / `Forbidden`.
 */
export async function createFixture(
  label: string,
  role: Role = "USER",
): Promise<Fixture> {
  const email = `p1fx-${label}-${runTag}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `P1 fixture ${label}` },
  });
  if (error) throw new Error(`createFixture(${label}): ${error.message}`);
  const id = data.user.id;

  // Let the profile-provisioning trigger settle before touching the row.
  await new Promise((r) => setTimeout(r, 1200));

  if (role === "ADMIN") {
    const { error: roleError } = await service
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", id);
    if (roleError) throw new Error(`promote(${label}): ${roleError.message}`);
  }

  const client = createClient(
    SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: FIXTURE_PASSWORD,
  });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  const fixture: Fixture = { id, email, role, client };
  registry.push(fixture);
  return fixture;
}

/** Signs in again as an existing fixture (used to prove a block does not end a session). */
export async function signInAs(fixture: Fixture) {
  const client = createClient(
    SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  return client.auth.signInWithPassword({
    email: fixture.email,
    password: FIXTURE_PASSWORD,
  });
}

/** A 1x1 PNG, small enough to keep avatar round-trips fast. */
export const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

export const avatarPath = (userId: string) => `${userId}/avatar.png`;

/**
 * Removes every fixture created in this run.
 *
 * USER fixtures are deleted before ADMIN fixtures: `profiles.blocked_by`
 * references the acting Admin, and deleting the Admin first fails with
 * "Database error deleting user".
 */
export async function cleanupFixtures() {
  const ordered = [
    ...registry.filter((f) => f.role === "USER"),
    ...registry.filter((f) => f.role === "ADMIN"),
  ];
  for (const f of ordered) {
    await service.storage.from("avatars").remove([avatarPath(f.id)]);
    await service
      .from("profiles")
      .update({ blocked_by: null })
      .eq("blocked_by", f.id);
    await service.auth.admin.deleteUser(f.id);
  }
  registry.length = 0;
}

/** Normalizes a PostgREST/Storage failure to a comparable string. */
export function errorOf(result: {
  error: { message: string; code?: string } | null;
}): string | null {
  if (!result.error) return null;
  return result.error.code
    ? `${result.error.code} ${result.error.message}`
    : result.error.message;
}
