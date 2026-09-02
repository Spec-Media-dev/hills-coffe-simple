import { expect, test, type Page } from "@playwright/test";
import {
  createAdminPersona,
  hasAuthFixtureCredentials,
} from "./admin-users-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * P5-T05 — the three Admin settings concerns are independent:
 *
 *   1. Site settings          (`/admin/settings`)
 *   2. the Admin's own profile   (`/admin/account`)
 *   3. the Admin's own credentials (`/admin/account`)
 *
 * "Independent" is the property under test: a validation failure in one must
 * not discard, reset, or overwrite anything in another.
 */
test.describe("Phase 5 Admin settings independence", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real persona writes run once on desktop; Admin responsive work is Phase 10.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let fixtures!: Awaited<ReturnType<typeof createAdminPersona>>;

  test.beforeAll(async ({}, workerInfo) => {
    test.setTimeout(120_000);
    fixtures = await createAdminPersona(workerInfo.project.name);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await fixtures?.cleanup();
  });

  async function signIn(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(fixtures.admin.email);
    await page
      .locator('input[name="password"]')
      .fill(fixtures.currentPassword());
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  const profileForm = (page: Page) =>
    page.locator('form:has(input[name="full_name"])');
  const emailForm = (page: Page) =>
    page.locator('form:has(input[name="email"])');
  const passwordForm = (page: Page) =>
    page.locator('form:has(input[name="currentPassword"])');

  test("an Administrator can save their own profile", async ({ page }) => {
    const problems = collectPageProblems(page);
    await signIn(page);
    await page.goto("/admin/account");

    const newName = `${fixtures.admin.fullName} edited`;
    const form = profileForm(page);
    await form.locator('input[name="full_name"]').fill(newName);
    await form.locator('input[name="company_name"]').fill("Hills QA");
    await form.locator('button[type="submit"]').click();

    await expect(form.getByRole("status")).toBeVisible();
    const profile = await fixtures.profileOf(fixtures.admin.id);
    expect(profile?.full_name).toBe(newName);
    expect(profile?.company_name).toBe("Hills QA");
    // The own-profile form may never touch role.
    expect(profile?.role).toBe("ADMIN");
    expect(problems.appErrors()).toEqual([]);
  });

  test("a failure in one settings form leaves the others untouched", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/account");

    // A pending, unsubmitted profile edit.
    const pendingName = `${fixtures.admin.fullName} pending`;
    await profileForm(page)
      .locator('input[name="full_name"]')
      .fill(pendingName);

    // Now fail the password form with a wrong current password.
    const password = passwordForm(page);
    await password.locator('input[name="currentPassword"]').fill("wrong-pass1");
    await password.locator('input[name="password"]').fill("NewHills12345!");
    await password
      .locator('input[name="confirmPassword"]')
      .fill("NewHills12345!");
    await password.locator('button[type="submit"]').click();
    await expect(password.getByRole("alert").first()).toBeVisible();

    // The failure did not reset the profile form...
    await expect(
      profileForm(page).locator('input[name="full_name"]'),
    ).toHaveValue(pendingName);
    // ...and did not write anything: the stored profile is the previously
    // saved value, not the pending one.
    const profile = await fixtures.profileOf(fixtures.admin.id);
    expect(profile?.full_name).toBe(`${fixtures.admin.fullName} edited`);

    // The valid profile edit still saves afterwards.
    await profileForm(page).locator('button[type="submit"]').click();
    await expect(profileForm(page).getByRole("status")).toBeVisible();
    expect((await fixtures.profileOf(fixtures.admin.id))?.full_name).toBe(
      pendingName,
    );
  });

  test("an Administrator's own email change is authorized and never committed locally", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/account");

    const form = emailForm(page);
    await form
      .locator('input[name="email"]')
      .fill(`changed-${fixtures.admin.email}`);
    await form.locator('button[type="submit"]').click();

    // What this asserts is the *authorization* boundary, not the delivery:
    // before Phase 5 this action ran behind `requireVerifiedUser()`, which an
    // Administrator can never satisfy, so every attempt came back "session
    // expired". Whether the provider then accepts the address is its own
    // concern — the staging project rejects `@example.com` for outbound mail,
    // so a fixture address cannot prove delivery here (finding N24).
    const outcome = form.getByRole("status").or(form.getByRole("alert"));
    await expect(outcome.first()).toBeVisible();
    await expect(outcome.first()).not.toHaveText(/session expired/i);
    // Whatever the provider said, the message is from the localized catalog:
    // no raw Supabase text reaches the page.
    await expect(outcome.first()).not.toHaveText(/supabase|invalid email add/i);

    // Nothing is committed until the link sent to the new address is followed,
    // and no application table ever stores an address or a credential.
    const profile = await fixtures.profileOf(fixtures.admin.id);
    expect(Object.keys(profile ?? {})).not.toContain("email");
    expect(Object.keys(profile ?? {})).not.toContain("password");
  });

  test("an Administrator can change their own password", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/account");

    const next = `P5-Rot-${Math.random().toString(36).slice(2)}!Aa9`;
    const form = passwordForm(page);
    await form
      .locator('input[name="currentPassword"]')
      .fill(fixtures.currentPassword());
    await form.locator('input[name="password"]').fill(next);
    await form.locator('input[name="confirmPassword"]').fill(next);
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole("status")).toBeVisible();
    fixtures.setPassword(next);

    // Proven by using it: a fresh sign-in with the new credential succeeds.
    await page.goto("/admin/account");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await signIn(page);
  });

  test("site settings save independently and require an Administrator", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/settings");

    const threshold = 20 + Math.floor(Math.random() * 40);
    const form = page.locator('form:has(input[name="lowStockThreshold"])');
    await form
      .locator('input[name="lowStockThreshold"]')
      .fill(String(threshold));
    await form.locator('button[type="submit"]').click();
    await expect(
      page.locator("main").getByText(/site settings updated/i),
    ).toBeVisible();
    expect(Number(await fixtures.siteSetting("low_stock_threshold"))).toBe(
      threshold,
    );

    // The Admin's own profile was not touched by the site-settings save.
    const profile = await fixtures.profileOf(fixtures.admin.id);
    expect(profile?.full_name).toContain(fixtures.admin.fullName);

    // An invalid site-settings submission does not overwrite the saved value.
    await page.goto("/admin/settings");
    const invalid = page.locator('form:has(input[name="lowStockThreshold"])');
    await invalid.locator('input[name="email"]').fill("not-an-email");
    await invalid.locator('input[name="lowStockThreshold"]').fill("999");
    await invalid.locator('button[type="submit"]').click();
    await expect(
      page.locator("main").getByText(/site settings updated/i),
    ).toHaveCount(0);
    expect(Number(await fixtures.siteSetting("low_stock_threshold"))).toBe(
      threshold,
    );
  });

  test("the settings areas are localized in Arabic", async ({ page }) => {
    await signIn(page);
    await page.goto("/ar/admin/account");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      /admin account/i,
    );
  });
});
