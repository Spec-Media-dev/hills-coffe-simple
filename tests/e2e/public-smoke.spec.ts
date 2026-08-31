import { expect, test } from "@playwright/test";
import {
  CMS_DEPENDENT_ROUTES,
  collectPageProblems,
  expectNoPriceLeak,
  firstDetailHref,
  horizontalTravel,
  PUBLIC_ROUTES,
} from "./helpers";

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders cleanly without leakage or overflow`, async ({
    page,
  }, testInfo) => {
    const problems = collectPageProblems(page);
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main, section").first()).toBeVisible();

    await page.screenshot({
      path: `artifacts/qa/${testInfo.project.name}-${route.replaceAll("/", "-") || "home"}.png`,
      fullPage: true,
    });

    expect(
      await horizontalTravel(page),
      `${route} must not scroll horizontally`,
    ).toBeLessThanOrEqual(1);

    await expectNoPriceLeak(page);
    expect(problems.appFailedResponses()).toEqual([]);
    expect(problems.appErrors()).toEqual([]);
  });
}

for (const route of CMS_DEPENDENT_ROUTES) {
  test(`${route} renders once its CMS content is published`, async ({
    page,
  }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    test.skip(
      response?.status() === 404,
      `${route} has no published CMS page in this database — publish it to enable this check`,
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoPriceLeak(page);
  });
}

test("public pages expose localized SEO metadata without price schema", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/green-coffee-offer-list",
    "/coffee-origins",
    "/knowledge",
    "/contact",
    "/ar",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/\S+/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="ar"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveCount(1);
    await expectNoPriceLeak(page);
  }
});

test("homepage advertises Organization and WebSite structured data", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const structuredData = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join(" ");
  expect(structuredData).toContain('"Organization"');
  expect(structuredData).toContain('"WebSite"');
});

test("offer list exposes visible breadcrumbs and BreadcrumbList schema", async ({
  page,
}) => {
  await page.goto("/green-coffee-offer-list", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("navigation", { name: /breadcrumb/i }),
  ).toBeVisible();
  const structuredData = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join(" ");
  expect(structuredData).toContain("BreadcrumbList");
});

test("coffee detail renders with breadcrumbs and no protected pricing", async ({
  page,
}) => {
  const href = await firstDetailHref(
    page,
    "/green-coffee-offer-list",
    "/green-coffee-offer-list",
  );
  test.skip(!href, "No published coffee offers in this database");
  const response = await page.goto(href!, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: /breadcrumb/i }),
  ).toBeVisible();
  await expectNoPriceLeak(page);
});

test("catalog and listing pages present a usable state even when empty", async ({
  page,
}) => {
  for (const route of [
    "/green-coffee-offer-list",
    "/coffee-origins",
    "/knowledge",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    // Either real records or an explicit empty state must be shown; a blank
    // content area is not acceptable (§68).
    const bodyText = await page.locator("main, body").first().innerText();
    expect(bodyText.trim().length).toBeGreaterThan(40);
  }
});
