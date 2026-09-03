import { expect, type Page, test } from "@playwright/test";
import { collectRuntimeProblems, devOverlayError } from "./helpers";

/**
 * DEVELOPMENT-MODE runtime cleanliness.
 *
 * Run with `npm run test:e2e:dev`, which serves the app via
 * `playwright.dev.config.ts` -> `npm run dev`.
 *
 * Why this file exists: the default `playwright.config.ts` runs
 * `npm run start`. React's "Encountered a script tag while rendering React
 * component" message is a **development-only** warning, so a production server
 * cannot emit it. Phase 2's original suite passed 134/134 against a production
 * build while that exact defect was still reproducible in `npm run dev` — the
 * suite was structurally blind to it. Anything asserting the absence of a React
 * development warning has to run here.
 *
 * These assertions cover several page families, not one representative route,
 * because the defect only appears where JSON-LD is present:
 *   - `/` .......................... Organization + WebSite schema
 *   - `/green-coffee-offer-list` ... BreadcrumbList + ItemList schema
 *   - pages without JSON-LD are included as controls.
 */

/**
 * Element-agnostic on purpose. If someone reverts the switcher to a
 * client-transition <button>, this still finds and clicks it, so the failure
 * reported is the real runtime defect rather than a selector timeout. That the
 * control must be an anchor is asserted separately, in locale-switch.spec.ts.
 */
const SWITCHER = '[aria-label="العربية"], [aria-label="English"]';

/** Pages that currently render without depending on absent CMS/catalog rows. */
const PAGE_FAMILIES = [
  { route: "/", label: "home", hasJsonLd: true },
  { route: "/green-coffee-offer-list", label: "catalog", hasJsonLd: true },
  { route: "/coffee-origins", label: "origins", hasJsonLd: false },
  { route: "/knowledge", label: "knowledge", hasJsonLd: false },
  { route: "/contact", label: "contact", hasJsonLd: false },
  { route: "/request-a-quote", label: "quote", hasJsonLd: false },
  { route: "/sign-in", label: "sign-in", hasJsonLd: false },
  { route: "/sign-up", label: "sign-up", hasJsonLd: false },
  { route: "/verify-email", label: "verify-email", hasJsonLd: false },
  { route: "/forgot-password", label: "forgot-password", hasJsonLd: false },
  { route: "/dashboard-admin", label: "admin-entry", hasJsonLd: false },
];

const arabic = (route: string) => (route === "/" ? "/ar" : `/ar${route}`);

type Problems = ReturnType<typeof collectRuntimeProblems>;

/** Asserts every runtime channel is clean, naming the offending message. */
async function expectCleanRuntime(
  page: Page,
  problems: Problems,
  context: string,
) {
  const found = problems.summary();
  expect(
    found.scriptTag,
    `${context}: React must not render a <script> on the client`,
  ).toEqual([]);
  expect(found.hydration, `${context}: no hydration error`).toEqual([]);
  expect(found.pageErrors, `${context}: no uncaught page error`).toEqual([]);
  expect(found.consoleErrors, `${context}: no console.error`).toEqual([]);
  expect(
    await devOverlayError(page),
    `${context}: the Next.js dev error overlay must not be showing`,
  ).toBeNull();
}

async function switchLocale(page: Page) {
  // Wait for the URL to actually change rather than for a load state: the fix
  // is a full document navigation, and `waitForLoadState` can resolve against
  // the outgoing document, which races the assertions that follow.
  const before = page.url();
  await page.locator(SWITCHER).first().click();
  await page.waitForURL((url) => url.toString() !== before, {
    timeout: 20_000,
  });
  await page.waitForLoadState("domcontentloaded");
}

test.describe("dev runtime — direct loads", () => {
  for (const { route, label, hasJsonLd } of PAGE_FAMILIES) {
    for (const url of [route, arabic(route)]) {
      test(`${label} ${url} renders cleanly`, async ({ page }) => {
        const problems = collectRuntimeProblems(page);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);

        await expectCleanRuntime(page, problems, `direct load ${url}`);

        const count = await page
          .locator('script[type="application/ld+json"]')
          .count();
        if (hasJsonLd) {
          expect(
            count,
            `${url} must still emit structured data`,
          ).toBeGreaterThan(0);
        }
      });
    }
  }
});

test.describe("dev runtime — locale switching", () => {
  for (const { route, label } of PAGE_FAMILIES) {
    test(`${label}: EN -> AR stays clean and sets lang/dir`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      problems.reset();

      await switchLocale(page);

      expect(new URL(page.url()).pathname).toBe(arabic(route));
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectCleanRuntime(page, problems, `EN -> AR from ${route}`);
    });

    test(`${label}: AR -> EN stays clean and sets lang/dir`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(arabic(route), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      problems.reset();

      await switchLocale(page);

      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expectCleanRuntime(
        page,
        problems,
        `AR -> EN from ${arabic(route)}`,
      );
    });
  }

  test("switching with a query string stays clean in both directions", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    const query = "?origin=ethiopia&sort=newest";
    await page.goto(`/green-coffee-offer-list${query}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    problems.reset();

    await switchLocale(page);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      `/ar/green-coffee-offer-list${query}`,
    );
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectCleanRuntime(page, problems, "EN -> AR with query");

    await switchLocale(page);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      `/green-coffee-offer-list${query}`,
    );
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expectCleanRuntime(page, problems, "AR -> EN with query");
  });

  test("repeated switching on a JSON-LD page never renders a script client-side", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const baseline = await page
      .locator('script[type="application/ld+json"]')
      .count();
    expect(baseline).toBeGreaterThan(0);
    problems.reset();

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await switchLocale(page);
      await switchLocale(page);
      expect(
        await page.locator('script[type="application/ld+json"]').count(),
        `cycle ${cycle}: structured data must be neither duplicated nor lost`,
      ).toBe(baseline);
    }

    await expectCleanRuntime(page, problems, "3x EN -> AR -> EN on catalog");
  });
});

test.describe("dev runtime — same-locale client navigation", () => {
  // Header links are next-intl <Link>s, i.e. App Router *client* transitions.
  // Navigating into a page whose payload carries JSON-LD is the other way this
  // class of defect can surface, so it is covered explicitly.
  const HOPS: Array<[string, string, string]> = [
    ["/", "/green-coffee-offer-list", "home -> catalog (JSON-LD)"],
    ["/", "/coffee-origins", "home -> origins"],
    ["/", "/knowledge", "home -> knowledge"],
    ["/contact", "/green-coffee-offer-list", "contact -> catalog (JSON-LD)"],
  ];

  for (const [from, to, label] of HOPS) {
    test(`${label} stays clean`, async ({ page }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(from, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const link = page.locator(`header a[href="${to}"]`).first();
      if ((await link.count()) === 0) {
        test.skip(true, `no header link to ${to} in this layout`);
        return;
      }
      problems.reset();

      await link.click();
      await page.waitForURL(`**${to}`);
      await page.waitForTimeout(1000);

      await expectCleanRuntime(page, problems, label);
    });
  }

  test("browser back and forward stay clean", async ({ page }) => {
    const problems = collectRuntimeProblems(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const link = page
      .locator('header a[href="/green-coffee-offer-list"]')
      .first();
    if ((await link.count()) === 0) {
      test.skip(true, "no catalog link in header");
      return;
    }
    await link.click();
    await page.waitForURL("**/green-coffee-offer-list");
    await page.waitForTimeout(800);
    problems.reset();

    await page.goBack();
    await page.waitForTimeout(1000);
    await expectCleanRuntime(page, problems, "history back");

    await page.goForward();
    await page.waitForTimeout(1000);
    await expectCleanRuntime(page, problems, "history forward");
  });
});

/**
 * OA-T10 — the anonymous submission flows under the same runtime gate.
 *
 * The direct-load and locale-switch suites above already cover
 * `/request-a-quote` as a page. They do not cover what happens when someone
 * actually submits: a server action round-trip, a `useActionState`
 * transition, and a success panel that appears after the fact. React
 * development warnings and hydration mismatches surface exactly there, so
 * the interaction gets its own pass — in development, where those warnings
 * exist at all.
 */
test.describe("dev runtime — anonymous submissions", () => {
  const created: string[] = [];

  test.afterAll(async () => {
    if (!created.length) return;
    const { service } = await import("./auth-fixtures");
    for (const email of created)
      await service.from("inquiries").delete().eq("email", email);
  });

  const email = (tag: string) =>
    `qa-oa-dev-${tag}-${Date.now().toString(36)}@example.invalid`;

  for (const locale of ["", "/ar"]) {
    test(`RFQ submission stays clean${locale || " (en)"}`, async ({ page }) => {
      test.setTimeout(120_000);
      const address = email(`rfq${locale ? "-ar" : ""}`);
      created.push(address);

      const problems = collectRuntimeProblems(page);
      await page.goto(`${locale}/request-a-quote`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(600);
      problems.reset();

      await page.fill('input[name="fullName"]', "[QA-OA-DEV] Buyer");
      await page.fill('input[name="email"]', address);
      await page.fill('input[name="phone"]', "+201000000123");
      await page.fill(
        'textarea[name="message"]',
        "Runtime cleanliness proof for the anonymous request form.",
      );
      await page.locator('form button[type="submit"]').click();

      await expect(page.locator("main").getByRole("status")).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(800);
      await expectCleanRuntime(
        page,
        problems,
        `RFQ submit at ${locale || "/"}/request-a-quote`,
      );
    });
  }

  test("sample dialog submission stays clean", async ({ page }) => {
    test.setTimeout(120_000);
    const address = email("sample");
    created.push(address);

    const problems = collectRuntimeProblems(page);
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    await page.locator('a[href*="/green-coffee-offer-list/"]').first().click();
    await page.waitForTimeout(800);
    problems.reset();

    await page.getByRole("button", { name: /request sample/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="fullName"]').fill("[QA-OA-DEV] Buyer");
    await dialog.locator('input[name="email"]').fill(address);
    await dialog.locator('input[name="phone"]').fill("+201000000123");
    await dialog.locator('input[name="address"]').fill("1 Test Street, Dubai");
    await dialog.locator('input[name="countryCode"]').fill("AE");
    await dialog
      .locator('textarea[name="message"]')
      .fill("Runtime cleanliness proof for the anonymous sample dialog.");
    await dialog.locator('button[type="submit"]').click();

    await expect(dialog.getByRole("status")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await expectCleanRuntime(page, problems, "sample dialog submit");
  });
});
