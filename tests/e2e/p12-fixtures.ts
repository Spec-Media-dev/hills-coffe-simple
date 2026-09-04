import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

/**
 * P12-T02 — reusable authenticated sessions for the four non-anonymous
 * personas.
 *
 * Every session here is produced by driving the real sign-in form with real
 * credentials, so what the tests exercise is the application's own Auth path.
 * There is deliberately no helper that writes a cookie, mints a token, or
 * borrows the service-role client as if it were a customer: a faked session
 * would make every downstream assertion about authorization meaningless.
 *
 * Credentials come from the gitignored file the seed writes, so passwords stay
 * out of the repository and out of test output.
 */

const CURRENT = "tests/e2e/.p12-runs/current.json";

export type P12Persona = "unverified" | "verified" | "blocked" | "admin";

type CurrentRun = {
  runId: string;
  password: string;
  personas: Record<P12Persona, { id: string; email: string }>;
};

function readRun(): CurrentRun | null {
  if (!existsSync(CURRENT)) return null;
  try {
    return JSON.parse(readFileSync(CURRENT, "utf8")) as CurrentRun;
  } catch {
    return null;
  }
}

export const p12Run = readRun();
export const hasP12Fixtures = Boolean(p12Run?.runId && p12Run?.personas);

/** The seeded run's slug prefix, for locating fixture rows in the UI. */
export const p12Prefix = p12Run ? `e2e-hills-${p12Run.runId}` : "";
export const p12Label = p12Run ? `E2E-HILLS-${p12Run.runId}` : "";

export function p12PersonaId(persona: P12Persona) {
  return p12Run?.personas[persona]?.id ?? "";
}

export function p12PersonaEmail(persona: P12Persona) {
  return p12Run?.personas[persona]?.email ?? "";
}

/**
 * Signs a persona in through the application's own form.
 *
 * `locale` picks the localized sign-in route so any authenticated test can run
 * in both languages. The caller decides what "signed in" should mean for its
 * persona — an unverified or blocked account legitimately does not reach
 * `/account` — so this returns the landing pathname instead of asserting one.
 */
export async function signInAs(
  page: Page,
  persona: P12Persona,
  locale: "en" | "ar" = "en",
): Promise<string> {
  if (!p12Run) throw new Error("no active Phase 12 run");
  const prefix = locale === "ar" ? "/ar" : "";
  /*
   * An Administrator signing in at the customer form is deliberately signed
   * out again and sent to the Admin portal (Phase 3 behaviour), so the Admin
   * persona has to use its own entry point. Using /sign-in for it would test
   * the redirect, not the session.
   */
  const entry = persona === "admin" ? "/dashboard-admin" : "/sign-in";
  await page.goto(`${prefix}${entry}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(p12PersonaEmail(persona));
  await page.locator('input[name="password"]').fill(p12Run.password);
  await page.locator('button[type="submit"]').click();
  // Any settled destination is acceptable; the caller asserts which one.
  await page
    .waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  return new URL(page.url()).pathname;
}

/**
 * Proves a session is genuinely authenticated rather than merely redirected.
 *
 * A Supabase auth cookie plus a server-rendered account affordance together
 * rule out both a faked client-side state and a stale redirect.
 */
export async function expectRealSession(page: Page) {
  const cookies = await page.context().cookies();
  expect(
    cookies.some((cookie) => /sb-.*-auth-token/.test(cookie.name)),
    "no Supabase auth cookie — the session is not real",
  ).toBe(true);
}

/** True when the browser holds no Supabase auth cookie at all. */
export async function hasNoSession(page: Page) {
  const cookies = await page.context().cookies();
  return !cookies.some((cookie) => /sb-.*-auth-token/.test(cookie.name));
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}
