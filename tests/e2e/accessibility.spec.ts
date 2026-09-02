import { expect, test } from "@playwright/test";
import { firstDetailHref, runAxe } from "./helpers";

/**
 * §79: each entry is a genuinely distinct screen or state, not the same page
 * counted once per Playwright project.
 */
const SCREENS: Array<{ label: string; route: string }> = [
  { label: "homepage", route: "/" },
  { label: "sign-in", route: "/sign-in" },
  { label: "sign-up", route: "/sign-up" },
  { label: "verify-email", route: "/verify-email?email=qa%40example.com" },
  { label: "forgot-password", route: "/forgot-password" },
  { label: "catalog", route: "/green-coffee-offer-list" },
  { label: "origins", route: "/coffee-origins" },
  { label: "knowledge", route: "/knowledge" },
  { label: "contact", route: "/contact" },
  { label: "admin-login", route: "/dashboard-admin" },
  { label: "arabic-homepage", route: "/ar" },
  { label: "arabic-catalog", route: "/ar/green-coffee-offer-list" },
  { label: "arabic-admin-login", route: "/ar/dashboard-admin" },
  { label: "not-found", route: "/nonexistent-xyz-404" },
];

for (const { label, route } of SCREENS) {
  test(`accessibility: ${label} has no WCAG A/AA violations`, async ({
    page,
  }, testInfo) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    // A 404 screen is a legitimate state to scan; other screens must render.
    if (label !== "not-found") expect(response?.status()).toBeLessThan(400);
    await runAxe(page, testInfo, `${label}-${testInfo.project.name}`);
  });
}

test("accessibility: about page (CMS dependent)", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/about", { waitUntil: "domcontentloaded" });
  test.skip(
    response?.status() === 404,
    "/about has no published CMS content in this database",
  );
  await runAxe(page, testInfo, `about-${testInfo.project.name}`);
});

test("accessibility: coffee detail page", async ({ page }, testInfo) => {
  const href = await firstDetailHref(
    page,
    "/green-coffee-offer-list",
    "/green-coffee-offer-list",
  );
  test.skip(
    !href,
    "No published coffee offers in this database — detail page cannot be scanned",
  );
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await runAxe(page, testInfo, `coffee-detail-${testInfo.project.name}`);
});

test("accessibility: origin detail page", async ({ page }, testInfo) => {
  const href = await firstDetailHref(
    page,
    "/coffee-origins",
    "/coffee-origins",
  );
  test.skip(
    !href,
    "No published origins in this database — detail page cannot be scanned",
  );
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await runAxe(page, testInfo, `origin-detail-${testInfo.project.name}`);
});

test("accessibility: homepage with the mobile menu open", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only state");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await runAxe(page, testInfo, "mobile-menu-open");
});

test("accessibility: arabic homepage with the mobile menu open", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only state");
  await page.goto("/ar", { waitUntil: "networkidle" });
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await runAxe(page, testInfo, "arabic-mobile-menu-open");
});

// The authenticated shells (account, admin workspace) are covered in
// `phase11-cross-cutting.spec.ts`, which signs in as each real persona from
// the Auth fixture set and runs the same axe configuration against them. No
// session is fabricated there either — the personas are created through the
// service role and cleaned up afterwards.
