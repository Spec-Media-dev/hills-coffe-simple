import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const PRICE_TEXT = /\$\s?\d+(?:[.,]\d+)?\s*\/\s*kg/i;
export const PRICE_SCHEMA = /"price"\s*:|"priceCurrency"\s*:|"offers"\s*:/i;

/**
 * Public routes that must always render for anonymous visitors, independent of
 * whether the catalogue database holds any rows.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/green-coffee-offer-list",
  "/coffee-origins",
  "/knowledge",
  "/contact",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/dashboard-admin",
  "/ar",
];

/**
 * Routes whose existence depends on published CMS content. With an empty CMS
 * these legitimately return 404, so they are checked separately.
 */
export const CMS_DEPENDENT_ROUTES = ["/about"];

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Raw status of a URL without following redirects, so redirect codes and real
 * 404s can be asserted instead of the status of the final destination.
 */
export async function rawResponse(page: Page, path: string) {
  return page.request.get(path, { maxRedirects: 0 });
}

export function collectPageProblems(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${response.status()} ${response.url()}`);
  });
  return {
    consoleErrors,
    failedResponses,
    /** Ignores noise that does not originate from application code. */
    appErrors: () =>
      consoleErrors.filter(
        (error) =>
          !error.includes("favicon") &&
          !error.includes("/_next/hmr") &&
          !error.includes("firebase-messaging") &&
          !error.includes("Download the React DevTools"),
      ),
    appFailedResponses: () =>
      failedResponses.filter(
        (entry) =>
          !entry.includes("favicon") && !entry.includes("firebase-messaging"),
      ),
  };
}

export async function horizontalTravel(page: Page) {
  return page.evaluate(() => {
    window.scrollTo(9999, 0);
    const positive = Math.abs(window.scrollX);
    window.scrollTo(-9999, 0);
    const negative = Math.abs(window.scrollX);
    window.scrollTo(0, 0);
    return Math.max(positive, negative);
  });
}

export async function expectNoPriceLeak(page: Page) {
  const body = await page.locator("body").innerText();
  expect(
    body,
    "rendered text must not expose protected per-kg pricing",
  ).not.toMatch(PRICE_TEXT);
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(
    structuredData.join(" "),
    "JSON-LD must never contain protected price data",
  ).not.toMatch(PRICE_SCHEMA);
}

/** Runs Axe and attaches a readable violation summary to the report. */
export async function runAxe(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: { include?: string } = {},
) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (options.include) builder = builder.include(options.include);
  const results = await builder.analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length,
    targets: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")),
  }));
  await testInfo.attach(`axe-${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  expect(
    summary,
    `Axe WCAG A/AA violations on ${label}: ${JSON.stringify(summary, null, 2)}`,
  ).toEqual([]);
  return results;
}

/**
 * Finds the first real detail link of a listing page. The staging database can
 * legitimately be empty, so callers skip instead of failing when none exists.
 */
export async function firstDetailHref(
  page: Page,
  listRoute: string,
  prefix: string,
) {
  const response = await page.goto(listRoute, {
    waitUntil: "domcontentloaded",
  });
  if (!response || response.status() >= 400) return null;
  const links = page.locator(`a[href^="${prefix}/"]`);
  if ((await links.count()) === 0) return null;
  return links.first().getAttribute("href");
}
