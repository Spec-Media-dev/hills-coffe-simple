import { expect, test, type Page } from "@playwright/test";
import {
  createAdminPersona,
  hasAuthFixtureCredentials,
} from "./admin-users-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 6 §20 — every Admin route currently in the workspace, in both
 * languages, as a signed-in Administrator.
 *
 * This is a smoke sweep, not a feature test: it proves each route resolves,
 * stays Admin-only, renders without a console or page error, keeps the public
 * chrome out, and does not loop. Modules owned by a later phase are visited
 * and reported on, but no later-phase business logic is implemented here.
 */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/products",
  "/admin/products/new",
  "/admin/offers",
  "/admin/offers/new",
  "/admin/pricing",
  "/admin/origins",
  "/admin/regions",
  "/admin/varieties",
  "/admin/warehouses",
  "/admin/taxonomy",
  "/admin/content",
  "/admin/articles",
  "/admin/article-categories",
  "/admin/media",
  "/admin/settings",
  "/admin/users",
  "/admin/inquiries",
  "/admin/audit",
  "/admin/account",
] as const;

test.describe("Phase 6 Admin-wide smoke", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Admin responsive behaviour is Phase 10; this sweep runs once on desktop.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 180_000 });

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

  test("every Admin route resolves cleanly in English", async ({ page }) => {
    const problems = collectPageProblems(page);
    await signIn(page);

    const failures: string[] = [];
    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      const status = response?.status() ?? 0;
      const url = new URL(page.url()).pathname;
      if (status >= 400) failures.push(`${route}: HTTP ${status}`);
      // Still authorized — never bounced back to the Admin entry.
      if (/dashboard-admin/.test(url))
        failures.push(`${route}: redirected to ${url}`);
      // The Admin shell replaces the public chrome entirely.
      if (await page.locator("footer").count())
        failures.push(`${route}: public footer present`);
      if (!(await page.locator("h1").count()))
        failures.push(`${route}: no heading rendered`);
    }
    expect(failures).toEqual([]);
    expect(problems.appErrors()).toEqual([]);
  });

  test("every Admin route resolves cleanly in Arabic and renders RTL", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signIn(page);

    const failures: string[] = [];
    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(`/ar${route}`, {
        waitUntil: "domcontentloaded",
      });
      const status = response?.status() ?? 0;
      if (status >= 400) failures.push(`/ar${route}: HTTP ${status}`);
      const html = page.locator("html");
      if ((await html.getAttribute("lang")) !== "ar")
        failures.push(`/ar${route}: lang is not ar`);
      if ((await html.getAttribute("dir")) !== "rtl")
        failures.push(`/ar${route}: dir is not rtl`);
      // The Arabic route must keep its prefix rather than leaking to English.
      if (!new URL(page.url()).pathname.startsWith("/ar/"))
        failures.push(`/ar${route}: locale leaked to ${page.url()}`);
    }
    expect(failures).toEqual([]);
    expect(problems.appErrors()).toEqual([]);
  });

  test("no Admin route is reachable without an Administrator session", async ({
    page,
  }) => {
    const failures: string[] = [];
    for (const route of ADMIN_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      if (!/dashboard-admin/.test(page.url()))
        failures.push(`${route}: anonymous reached ${page.url()}`);
    }
    expect(failures).toEqual([]);
  });

  test("the catalog workspaces list their real rows", async ({ page }) => {
    await signIn(page);

    // The QA catalog seeded and created in this phase must actually show.
    await page.goto("/admin/products");
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);

    await page.goto("/admin/offers");
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);

    await page.goto("/admin/pricing");
    await expect(page.locator("table tbody tr")).not.toHaveCount(0);

    await page.goto("/admin/origins");
    await expect(page.getByText(/Ethiopia/)).not.toHaveCount(0);
  });
});
