import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `getSupabaseConfig()` is the single place the Supabase project URL is
 * normalised. The Supabase client appends its own `/auth/v1` and `/rest/v1`
 * paths, so it must receive the bare project origin. A configured value that
 * carries `/rest/v1/` (which this project's own `.env.local` has historically
 * done) would otherwise produce doubled paths and break every Auth call.
 *
 * `.env.example` documents the correct shape; these tests pin the defensive
 * normalisation that keeps a mis-shaped value from reaching the client.
 */
const PROJECT = "https://abcdefghijklm.supabase.co";

async function loadConfig(url: string | undefined, key = "publishable-key") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url ?? "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getSupabaseConfig", () => {
  it("passes through a correctly shaped bare project origin", async () => {
    const { getSupabaseConfig } = await loadConfig(PROJECT);
    expect(getSupabaseConfig().url).toBe(PROJECT);
  });

  it("strips a /rest/v1/ suffix so the client can append its own paths", async () => {
    const { getSupabaseConfig } = await loadConfig(`${PROJECT}/rest/v1/`);
    expect(getSupabaseConfig().url).toBe(PROJECT);
  });

  it("strips a trailing slash, query and fragment", async () => {
    const { getSupabaseConfig } = await loadConfig(`${PROJECT}/?a=1#b`);
    expect(getSupabaseConfig().url).toBe(PROJECT);
  });

  it("never returns a URL the client would double up on", async () => {
    for (const raw of [
      PROJECT,
      `${PROJECT}/`,
      `${PROJECT}/rest/v1`,
      `${PROJECT}/rest/v1/`,
      `${PROJECT}/auth/v1/`,
    ]) {
      const { getSupabaseConfig } = await loadConfig(raw);
      const { url } = getSupabaseConfig();
      expect(url, `normalising ${raw}`).toBe(PROJECT);
      expect(url.endsWith("/")).toBe(false);
      expect(url).not.toContain("/rest/");
      expect(url).not.toContain("/auth/");
    }
  });

  it("throws a safe error when the URL is missing", async () => {
    const { getSupabaseConfig } = await loadConfig(undefined);
    expect(() => getSupabaseConfig()).toThrow(
      /Supabase environment variables are not configured/,
    );
  });

  it("throws when the key is missing rather than returning a partial config", async () => {
    const { getSupabaseConfig } = await loadConfig(PROJECT, "");
    expect(() => getSupabaseConfig()).toThrow();
  });

  it("reports configuration state without throwing", async () => {
    const configured = await loadConfig(PROJECT);
    expect(configured.isSupabaseConfigured()).toBe(true);
    const missing = await loadConfig(undefined, "");
    expect(missing.isSupabaseConfigured()).toBe(false);
  });
});
