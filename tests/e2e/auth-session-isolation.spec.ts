import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { collectRuntimeProblems, devOverlayError } from "./helpers";
import { service } from "./auth-fixtures";
import {
  hasNoSession,
  hasP12Fixtures,
  p12PersonaEmail,
  p12Run,
  signInAs,
} from "./p12-fixtures";

/**
 * Permanent regression coverage for the Phase-12 authorization defect the
 * owner reproduced by hand.
 *
 * The report: completing the public customer sign-up / email-verification flow
 * landed the browser inside the Admin workspace at `/admin`, showing an Admin
 * identity. The new customer was never granted ADMIN and the Admin guard never
 * failed — the browser was still carrying an Administrator's session from
 * earlier, the public customer flow never replaced it, and a public route then
 * classified that stale identity and forwarded it into `/admin`.
 *
 * The class of bug is: **a public customer flow choosing a privileged
 * destination from an identity that flow did not establish.** These tests are
 * written against that class rather than against one URL, because it was
 * reachable through two separate doors — the verification screen and the auth
 * callback's settle branch.
 *
 * Deliberately, the decisive assertions do not depend on an email being sent.
 * The provider rate-limits sign-up mail, and a security regression test that
 * silently stops exercising the bug when a quota runs out is worse than no
 * test. Every hop below is driven directly.
 */

// Not serial: each case is independent, and one failure in a security suite
// must never hide the verdict of the others.
// A refused sign-in and a provider round-trip both take longer than the
// default 30s budget, and neither is a product fault.
test.describe.configure({ mode: "default", timeout: 150_000 });

test.skip(
  !hasP12Fixtures,
  "P12 fixtures unavailable — run `node scripts/e2e/seed.mjs` first",
);

const RUN = p12Run?.runId ?? "";
const PASSWORD = p12Run?.password ?? "";
/** Matches the Admin workspace in either locale, and nothing else. */
const ADMIN_ROUTE = /^\/(ar\/)?admin(\/|$)/;
const RATE_LIMITED = /too many sign-?up emails|طلبات كثيرة/i;

/**
 * Registers a sign-up-form account in the run manifest.
 *
 * Cleanup deletes only manifest-proven ids, so an account this suite creates
 * through the UI has to be recorded the way the seed records its own.
 * Otherwise it survives as exactly the orphan residue the Phase-12 rules
 * forbid.
 */
async function adoptSignupUser(email: string) {
  const { data } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const created = data.users.find((user) => user.email === email);
  if (!created) return null;
  const path = `tests/e2e/.p12-runs/${RUN}.json`;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.authUsers ??= [];
  if (
    !manifest.authUsers.some((user: { id: string }) => user.id === created.id)
  )
    manifest.authUsers.push({
      persona: "signup-isolation",
      id: created.id,
      email,
    });
  writeFileSync(path, JSON.stringify(manifest, null, 2));
  return created.id;
}

let signupCounter = 0;
const nextSignupEmail = () =>
  `e2e-hills-${RUN}-signup-${(signupCounter += 1)}-${Date.now()}@example.com`;

/** Drives the real public sign-up form. No admin API, no forged state. */
async function submitPublicSignUp(
  page: Page,
  email: string,
  locale: "en" | "ar",
) {
  await page.goto(`${locale === "ar" ? "/ar" : ""}/sign-up`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('input[name="fullName"]').fill("E2E Isolation Customer");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill("+201000000000");
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  // The action calls the provider, which is slow; wait for the settled
  // outcome rather than for the network to look quiet.
  await page
    .waitForURL((url) => !url.pathname.endsWith("/sign-up"), {
      timeout: 60_000,
    })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await adoptSignupUser(email);
  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  return { rateLimited: RATE_LIMITED.test(body) };
}

const pathOf = (page: Page) => new URL(page.url()).pathname;

async function expectCleanRuntime(
  page: Page,
  problems: ReturnType<typeof collectRuntimeProblems>,
  label: string,
) {
  const found = problems.summary();
  expect(found.hydration, `${label}: hydration error`).toEqual([]);
  expect(found.pageErrors, `${label}: page error`).toEqual([]);
  expect(found.consoleErrors, `${label}: console.error`).toEqual([]);
  expect(await devOverlayError(page), `${label}: dev overlay error`).toBeNull();
}

// ---------------------------------------------------------------- CASE B
// The reported regression. Three separate ways it could come back.

for (const locale of ["en", "ar"] as const)
  test(`CASE B (${locale}): the customer verification screen must never forward an Administrator into the Admin workspace`, async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "admin", locale);
    expect(pathOf(page)).toMatch(ADMIN_ROUTE);

    // This is the exact destination signUpAction sends every new customer to.
    // Reached with an Administrator session live, it used to resolve to
    // /admin, which is how a customer signup ended up in the Admin workspace.
    const prefix = locale === "ar" ? "/ar" : "";
    await page.goto(`${prefix}/verify-email?email=new-customer%40example.com`, {
      waitUntil: "domcontentloaded",
    });
    expect(
      ADMIN_ROUTE.test(pathOf(page)),
      `the public verification screen resolved to ${pathOf(page)}`,
    ).toBe(false);
    await expectCleanRuntime(page, problems, `case-b-verify/${locale}`);
  });

test("CASE B: the auth callback must not settle a session it never established", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  await signInAs(page, "admin", "en");

  // `settled=1` is an unauthenticated query parameter. Asserted by hand with a
  // pre-existing session in the browser, it used to make the callback classify
  // that session and forward it into the Admin workspace, having confirmed
  // nothing at all.
  await page.goto("/auth/callback?settled=1&next=%2Faccount", {
    waitUntil: "domcontentloaded",
  });
  expect(
    ADMIN_ROUTE.test(pathOf(page)),
    `a forged settle callback resolved to ${pathOf(page)}`,
  ).toBe(false);
  await expectCleanRuntime(page, problems, "case-b-settled");
});

test("CASE B: a public signup does not leave an Administrator session live", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  await signInAs(page, "admin", "en");
  expect(pathOf(page)).toMatch(ADMIN_ROUTE);

  const email = nextSignupEmail();
  const { rateLimited } = await submitPublicSignUp(page, email, "en");

  // Holds whether or not the provider accepted the signup: the incompatible
  // session is replaced before the flow starts, so a provider rate limit can
  // never leave an Administrator signed in behind a customer signup.
  expect(
    ADMIN_ROUTE.test(pathOf(page)),
    `public signup resolved into the Admin workspace at ${pathOf(page)}`,
  ).toBe(false);

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  expect(
    ADMIN_ROUTE.test(pathOf(page)),
    `the Administrator session survived a public signup (landed ${pathOf(page)})`,
  ).toBe(false);

  if (!rateLimited) await expectCleanRuntime(page, problems, "case-b-signup");
});

// ---------------------------------------------------------------- CASE A
test("CASE A: a fresh anonymous signup resolves only to a public customer destination", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  const email = nextSignupEmail();
  const { rateLimited } = await submitPublicSignUp(page, email, "en");

  expect(ADMIN_ROUTE.test(pathOf(page))).toBe(false);
  if (!rateLimited) {
    await expect(page).toHaveURL(/\/verify-email/);
    await expectCleanRuntime(page, problems, "case-a");
  }
});

/*
 * The positive half of CASE A, proven without the provider.
 *
 * Sign-up mail is rate-limited, so a suite that could only observe the
 * customer destination after a successfully *sent* email would quietly stop
 * checking it whenever the quota ran out. `/verify-email` is the exact
 * destination `signUpAction` produces, so driving it directly proves the same
 * contract every time.
 */
test("CASE A: the signup destination serves customers and never bridges to Admin", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);

  // Anonymous: the waiting screen itself, not a redirect anywhere privileged.
  await page.goto("/verify-email?email=new-customer%40example.com", {
    waitUntil: "domcontentloaded",
  });
  expect(pathOf(page)).toMatch(/\/verify-email$/);
  await expect(page.locator("main, section").first()).toBeVisible();

  // A verified customer belongs in their own account, never in /admin.
  await signInAs(page, "verified", "en");
  await page.goto("/verify-email", { waitUntil: "domcontentloaded" });
  expect(pathOf(page)).toBe("/account");
  await expectCleanRuntime(page, problems, "case-a-destination");
});

// ---------------------------------------------------------------- CASE C
test("CASE C: a verified customer session must not carry a new signup anywhere privileged", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  await signInAs(page, "verified", "en");
  const email = nextSignupEmail();
  const { rateLimited } = await submitPublicSignUp(page, email, "en");

  expect(
    ADMIN_ROUTE.test(pathOf(page)),
    `signup landed at ${pathOf(page)}`,
  ).toBe(false);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  expect(ADMIN_ROUTE.test(pathOf(page))).toBe(false);
  if (!rateLimited) await expectCleanRuntime(page, problems, "case-c");
});

// ------------------------------------------------------- CASES D, E, F
const DENIED = [
  { persona: "verified", label: "CASE D: a verified customer" },
  { persona: "unverified", label: "CASE E: an unverified customer" },
  { persona: "blocked", label: "CASE F: a blocked customer" },
] as const;

for (const { persona, label } of DENIED)
  test(`${label} is denied /admin and /admin/**`, async ({ page }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, persona, "en");

    for (const route of ["/admin", "/admin/users", "/admin/inquiries"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(
        ADMIN_ROUTE.test(pathOf(page)),
        `${persona} reached ${route} (landed ${pathOf(page)})`,
      ).toBe(false);
    }
    await expectCleanRuntime(page, problems, `denied/${persona}`);
  });

// ---------------------------------------------------------------- CASE G
for (const locale of ["en", "ar"] as const)
  test(`CASE G (${locale}): an Administrator reaches the workspace through /dashboard-admin`, async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "admin", locale);
    expect(pathOf(page)).toMatch(ADMIN_ROUTE);
    await expect(page.locator("main")).toBeVisible();
    expect(await hasNoSession(page)).toBe(false);
    await expectCleanRuntime(page, problems, `case-g/${locale}`);
  });

// ---------------------------------------------------------------- CASE H
test("CASE H: an Administrator using the public customer sign-in is refused customer capability", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(p12PersonaEmail("admin"));
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle").catch(() => undefined);

  // Approved Phase-3 behaviour: refused at the customer door, no customer
  // capability granted, and no bridge into the Admin workspace from here.
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  expect(pathOf(page)).toMatch(/\/sign-in/);
  await expectCleanRuntime(page, problems, "case-h");
});
