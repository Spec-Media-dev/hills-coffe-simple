import { expect, test } from "@playwright/test";
import { auditScreen, visitInTheme } from "./ui-audit";
import { expectNoPriceLeak, runAxe } from "./helpers";

const routes = [
  "/",
  "/about",
  "/green-coffee-offer-list",
  "/coffee-origins",
  "/knowledge",
  "/contact",
] as const;
const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 1000 },
] as const;

test("Phase 9 visual matrix: public routes × locale × theme × viewport", async ({
  page,
}) => {
  test.setTimeout(300_000);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "ar"] as const) {
      for (const theme of ["light", "dark"] as const) {
        for (const route of routes) {
          const path =
            locale === "ar" ? `/ar${route === "/" ? "" : route}` : route;
          await visitInTheme(page, path, theme);
          await expect(page.locator("h1")).toHaveCount(1);
          await expectNoPriceLeak(page);
          const label = `${locale}-${theme}-${viewport.name}-${route.replaceAll("/", "-") || "home"}`;
          await auditScreen(page, label);
          await page.screenshot({
            path: `artifacts/phase-9/${label}.jpg`,
            type: "jpeg",
            quality: 72,
            fullPage: false,
          });
        }
      }
    }
  }
});

test("Phase 9 navigation patterns are keyboard and touch accessible", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  /*
   * "Products" is now a link straight to the catalog, and the panel is opened
   * by a separate chevron control beside it — the standard split-trigger
   * pattern, adopted so the header keeps a direct route to the catalog after
   * the search icon (which used to be that route) became real search.
   *
   * The keyboard contract asserted below is unchanged: focus the disclosure,
   * Enter opens it, Escape closes it, and `aria-expanded` tracks both.
   */
  await expect(
    page.locator('header a[href="/green-coffee-offer-list"]'),
    "the header lost its direct catalog link",
  ).toHaveCount(1);
  const products = page.getByRole("button", {
    name: "Show product categories",
    exact: true,
  });
  await products.focus();
  await products.press("Enter");
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#catalog-mega-menu")).toBeVisible();
  await products.press("Escape");
  await expect(products).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ar", { waitUntil: "networkidle" });
  const menu = page.locator('button[aria-haspopup="dialog"]').first();
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await runAxe(page, testInfo, "phase9-ar-mobile-drawer");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Phase 9 reduced motion keeps every rendered primitive visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  const states = await page.locator("[data-motion]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        opacity: style.opacity,
        transform: style.transform,
        clipPath: style.clipPath,
      };
    }),
  );
  expect(states.length).toBeGreaterThan(3);
  for (const state of states) {
    expect(state.opacity).not.toBe("0");
    expect(state.transform).toBe("none");
    expect(["none", "inset(0px)"]).toContain(state.clipPath);
  }
  await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("search")).toBeVisible();
});

test("Phase 9 public shell never exposes an Admin destination", async ({
  page,
}) => {
  for (const path of ["/", "/ar"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('header a[href*="admin"], footer a[href*="admin"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('footer a[href="/privacy"], footer a[href="/terms"]'),
    ).toHaveCount(0);
  }
});

test("Phase 9 homepage meets the local LCP and CLS targets", async ({
  browser,
}, testInfo) => {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const target = window as Window & {
        __phase9Vitals?: { cls: number; lcp: number };
      };
      target.__phase9Vitals = { cls: 0, lcp: 0 };
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries())
          target.__phase9Vitals!.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!shift.hadRecentInput) target.__phase9Vitals!.cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1_000);
    const metrics = await page.evaluate(
      () =>
        (
          window as Window & {
            __phase9Vitals?: { cls: number; lcp: number };
          }
        ).__phase9Vitals!,
    );
    await testInfo.attach(`phase9-${viewport.name}-vitals.json`, {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: "application/json",
    });
    console.log(
      `PHASE9_VITALS ${viewport.name} LCP=${metrics.lcp.toFixed(1)}ms CLS=${metrics.cls.toFixed(4)}`,
    );
    expect(metrics.lcp, `${viewport.name} LCP`).toBeLessThanOrEqual(2_500);
    expect(metrics.cls, `${viewport.name} CLS`).toBeLessThanOrEqual(0.1);
    await context.close();
  }
});
