import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  flowSubjectHash,
  signAuthFlowToken,
} from "../../src/lib/auth/flow-token";

function loadEnv() {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      values[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // CI may provide values directly.
  }
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AUTH_FLOW_SECRET",
  ])
    if (process.env[key]) values[key] = process.env[key] as string;
  return values;
}

const env = loadEnv();
const publicKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasAuthFixtureCredentials = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && publicKey && env.SUPABASE_SERVICE_ROLE_KEY,
);

const projectUrl = hasAuthFixtureCredentials
  ? (() => {
      const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    })()
  : "";

/**
 * Exported so a second persona suite (Phase 5's Admin Users workspace) can
 * build its own fixtures without duplicating the `.env.local` loader and the
 * bare-origin URL normalization.
 */
export const supabaseProjectUrl = projectUrl;
export const supabasePublicKey = publicKey;

export const service: SupabaseClient = hasAuthFixtureCredentials
  ? createClient(projectUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : (null as unknown as SupabaseClient);

type Persona = {
  id: string;
  email: string;
  password: string;
};

export type AuthFixtureSet = {
  unverified: Persona;
  verified: Persona;
  blocked: Persona;
  midBlock: Persona;
  recovery: Persona;
  admin: Persona;
  block: (persona: Persona) => Promise<void>;
  userStillExists: (id: string) => Promise<boolean>;
  recoveryCallback: (persona: Persona) => Promise<string>;
  cleanup: () => Promise<void>;
};

export async function createAuthFixtureSet(
  label: string,
): Promise<AuthFixtureSet> {
  if (!hasAuthFixtureCredentials)
    throw new Error("Auth fixture credentials are unavailable");

  const tag = `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const password = `P3-Fx-${Math.random().toString(36).slice(2)}!Aa9`;
  const created: Persona[] = [];

  async function createPersona(
    name: string,
    confirmed: boolean,
    role: "USER" | "ADMIN" = "USER",
  ) {
    const email = `e2e-hills-p3-${name}-${tag}@example.com`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: confirmed,
      user_metadata: {
        full_name: `E2E HILLS P3 ${name}`,
        phone: "+201000000000",
      },
    });
    if (error) throw new Error(`create ${name}: ${error.message}`);
    const persona = { id: data.user.id, email, password };
    created.push(persona);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("id", persona.id)
        .maybeSingle();
      if (profile) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (role === "ADMIN") {
      const { error: roleError } = await service
        .from("profiles")
        .update({ role })
        .eq("id", persona.id);
      if (roleError) throw new Error(`promote ${name}: ${roleError.message}`);
    }
    return persona;
  }

  const unverified = await createPersona("unverified", false);
  const verified = await createPersona("verified", true);
  const blocked = await createPersona("blocked", true);
  const midBlock = await createPersona("midblock", true);
  const recovery = await createPersona("recovery", true);
  const admin = await createPersona("admin", true, "ADMIN");

  const adminClient = createClient(projectUrl, publicKey, {
    auth: { persistSession: false },
  });
  const { error: adminSignInError } = await adminClient.auth.signInWithPassword(
    {
      email: admin.email,
      password: admin.password,
    },
  );
  if (adminSignInError)
    throw new Error(`fixture admin sign-in: ${adminSignInError.message}`);

  const block = async (persona: Persona) => {
    const { error } = await adminClient.rpc("admin_set_user_blocked", {
      target_user_id: persona.id,
      blocked: true,
      reason: "E2E-HILLS Phase 3 fixture",
    });
    if (error) throw new Error(`block ${persona.id}: ${error.message}`);
  };
  await block(blocked);

  return {
    unverified,
    verified,
    blocked,
    midBlock,
    recovery,
    admin,
    block,
    userStillExists: async (id) => {
      const { data } = await service.auth.admin.getUserById(id);
      return data.user?.id === id;
    },
    recoveryCallback: async (persona) => {
      const secret = env.AUTH_FLOW_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
      const flow = signAuthFlowToken(
        {
          kind: "recovery-intent",
          subject: flowSubjectHash(persona.email, secret),
          expiresAt: Date.now() + 15 * 60 * 1000,
        },
        secret,
      );
      const { data, error } = await service.auth.admin.generateLink({
        type: "recovery",
        email: persona.email,
      });
      if (error || !data.properties.hashed_token)
        throw new Error(
          `generate recovery link: ${error?.message ?? "missing token"}`,
        );
      const query = new URLSearchParams({
        token_hash: data.properties.hashed_token,
        type: "recovery",
        next: "/reset-password",
        flow,
      });
      return `/auth/callback?${query.toString()}`;
    },
    cleanup: async () => {
      await adminClient.auth.signOut();
      for (const persona of created.filter((item) => item.id !== admin.id))
        await service.auth.admin.deleteUser(persona.id);
      await service.auth.admin.deleteUser(admin.id);
    },
  };
}
