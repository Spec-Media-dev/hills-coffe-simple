import { expect, type Page, test } from "@playwright/test";
import {
  collectRuntimeProblems,
  devOverlayError,
  rawResponse,
} from "./helpers";

/**
 * Phase 2 regression guard for the three locale-switch defects reproduced in
 * Phase 0, all caused by the switcher performing an App Router *client*
 * transition (`router.replace(pathname, { locale })`):
 *
 *  D1  React logged "Encountered a script tag while rendering React component"
 *      when the transition re-rendered JSON-LD on the client.
 *  D2  `<html lang>` / `<html dir>` went stale — the root layout owns them and
 *      is not re-rendered by a soft navigation — so Arabic rendered LTR.
 *  D3  The query string was dropped, losing catalog filters.
 *
 * Asserting the resulting URL alone is NOT sufficient: Phase 0 proved the URL
 * was already correct while `lang`/`dir` were wrong. Every hop below therefore
 * asserts the resulting *document* as well.
 */

/** The switcher is a real anchor, labelled with the language it switches to. */
/**
 * Element-agnostic on purpose. If someone reverts the switcher to a
 * client-transition <button>, this still finds and clicks it, so the failure
 * reported is the real runtime defect rather than a selector timeout. That the
 * control must be an anchor is asserted separately, in locale-switch.spec.ts.
 */
const SWITCHER = '[aria-label="العربية"], [aria-label="English"]';

/**
 * Asserts every runtime channel is clean. The script-tag and hydration
 * messages are React *development* warnings, so this only has teeth when the
 * suite runs against `npm run dev` — see `playwright.dev.config.ts`, which
 * runs this file a second time against a development server.
 */
async function expectCleanRuntime(
  page: Page,
  problems: ReturnType<typeof collectRuntimeProblems>,
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

async function documentState(page: Page) {
  const html = page.locator("html");
  return {
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    lang: await html.getAttribute("lang"),
    dir: await html.getAttribute("dir"),
  };
}

/** Clicks the switcher and waits for the resulting document navigation. */
async function switchLocale(page: Page) {
  // The switcher is a real anchor whose `href` is only the localized pathname;
  // `search` and `hash` are re-added by its click handler, deliberately read
  // from `window.location` rather than `useSearchParams()` so that placing it
  // in the shared header does not opt every page out of static rendering.
  //
  // That means a click landing BEFORE hydration follows the bare href and
  // loses the query string — a real, narrow limitation recorded as N40, not
  // something the click handler can fix. Waiting for hydration here keeps this
  // test measuring the switcher's behaviour instead of racing React, and the
  // pre-hydration case is covered by the finding rather than by a coin flip.
  await page.locator(SWITCHER).first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const anchor = document.querySelector<HTMLAnchorElement>(
      'a[hreflang="ar"], a[hreflang="en"]',
    );
    // React attaches its listener during hydration; once the root is
    // hydrated Next marks the document ready for interaction.
    return Boolean(anchor) && document.readyState === "complete";
  });

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

const EN_TO_AR: Array<[string, string]> = [
  ["/", "/ar"],
  ["/green-coffee-offer-list", "/ar/green-coffee-offer-list"],
  ["/coffee-origins", "/ar/coffee-origins"],
  ["/knowledge", "/ar/knowledge"],
  ["/contact", "/ar/contact"],
  ["/sign-in", "/ar/sign-in"],
  ["/dashboard-admin", "/ar/dashboard-admin"],
];

test.describe("locale switching", () => {
  for (const [from, to] of EN_TO_AR) {
    test(`EN -> AR from ${from} preserves the path and sets lang/dir`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(from, { waitUntil: "domcontentloaded" });
      problems.reset();
      await switchLocale(page);

      const state = await documentState(page);
      expect(state.url, "pathname must be preserved across the switch").toBe(
        to,
      );
      expect(state.lang, "Arabic document must declare lang=ar").toBe("ar");
      expect(state.dir, "Arabic document must declare dir=rtl").toBe("rtl");

      await expectCleanRuntime(page, problems, `EN -> AR from ${from}`);
    });
  }

  for (const [to, from] of EN_TO_AR) {
    test(`AR -> EN from ${from} preserves the path and sets lang/dir`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(from, { waitUntil: "domcontentloaded" });
      problems.reset();
      await switchLocale(page);

      const state = await documentState(page);
      expect(state.url).toBe(to);
      expect(state.lang, "English document must declare lang=en").toBe("en");
      expect(state.dir, "English document must declare dir=ltr").toBe("ltr");
      await expectCleanRuntime(page, problems, `AR -> EN from ${from}`);
    });
  }

  test("the query string survives a switch in both directions (D3)", async ({
    page,
  }) => {
    const query = "?origin=ethiopia&sort=newest";

    await page.goto(`/green-coffee-offer-list${query}`, {
      waitUntil: "domcontentloaded",
    });
    await switchLocale(page);
    let state = await documentState(page);
    expect(state.url, "catalog filters must survive EN -> AR").toBe(
      `/ar/green-coffee-offer-list${query}`,
    );
    expect(state.lang).toBe("ar");
    expect(state.dir).toBe("rtl");

    await switchLocale(page);
    state = await documentState(page);
    expect(state.url, "catalog filters must survive AR -> EN").toBe(
      `/green-coffee-offer-list${query}`,
    );
    expect(state.lang).toBe("en");
    expect(state.dir).toBe("ltr");
  });

  test("the hash fragment survives a switch", async ({ page }) => {
    await page.goto("/contact#form", { waitUntil: "domcontentloaded" });
    await switchLocale(page);
    expect(new URL(page.url()).hash).toBe("#form");
    expect(new URL(page.url()).pathname).toBe("/ar/contact");
  });

  test("repeated EN -> AR -> EN cycles stay clean (D1, D2, D3)", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    const query = "?origin=ethiopia&sort=newest";
    await page.goto(`/green-coffee-offer-list${query}`, {
      waitUntil: "domcontentloaded",
    });
    problems.reset();

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await switchLocale(page);
      let state = await documentState(page);
      expect(state, `cycle ${cycle} EN -> AR`).toMatchObject({
        url: `/ar/green-coffee-offer-list${query}`,
        lang: "ar",
        dir: "rtl",
      });

      await switchLocale(page);
      state = await documentState(page);
      expect(state, `cycle ${cycle} AR -> EN`).toMatchObject({
        url: `/green-coffee-offer-list${query}`,
        lang: "en",
        dir: "ltr",
      });
    }

    await expectCleanRuntime(page, problems, "3x EN -> AR -> EN");
  });

  test("structured data is emitted once per document, not duplicated", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const before = await page
      .locator('script[type="application/ld+json"]')
      .count();
    expect(before).toBeGreaterThan(0);

    await switchLocale(page);
    const after = await page
      .locator('script[type="application/ld+json"]')
      .count();
    expect(after, "switching locale must not accumulate JSON-LD blocks").toBe(
      before,
    );
  });

  test("the switcher is a real link, so it works without JavaScript", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const switcher = page.locator(SWITCHER).first();
    await expect(switcher).toHaveAttribute(
      "href",
      "/ar/green-coffee-offer-list",
    );
    await expect(switcher).toHaveAttribute("hreflang", "ar");
    expect(await switcher.evaluate((node) => node.tagName)).toBe("A");
  });
});

test.describe("locale route architecture", () => {
  test("no /en-prefixed URL is ever produced, and /en redirects away", async ({
    page,
  }) => {
    for (const route of ["/", "/ar", "/green-coffee-offer-list", "/contact"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(
        new URL(page.url()).pathname,
        "the default locale must stay unprefixed",
      ).not.toMatch(/^\/en(\/|$)/);

      const hrefs = await page.locator("a[href^='/en/']").count();
      expect(hrefs, `${route} must not link to /en/* paths`).toBe(0);
    }

    const response = await rawResponse(page, "/en/green-coffee-offer-list");
    expect(response.status()).toBe(308);
    // The Location header is relative, so resolve it against the request URL.
    expect(new URL(response.headers().location, response.url()).pathname).toBe(
      "/green-coffee-offer-list",
    );
  });

  test("locale entry points settle without a redirect loop", async ({
    page,
  }) => {
    for (const route of [
      "/",
      "/ar",
      "/en",
      "/admin",
      "/ar/admin",
      "/admin/login",
      "/ar/admin/login",
      "/account",
      "/ar/account",
    ]) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(response, `${route} must resolve`).not.toBeNull();
      // A loop would exhaust Playwright's redirect budget and throw before
      // reaching here; a settled 2xx confirms the chain terminated.
      expect(response!.status(), `${route} settled status`).toBeLessThan(400);
      const chain = new URL(page.url()).pathname;
      expect(chain).not.toMatch(/^\/en(\/|$)/);
    }
  });

  test("/auth/callback stays outside locale routing", async ({ page }) => {
    // Reachable globally, and never rewritten under a locale segment.
    const global = await rawResponse(page, "/auth/callback");
    expect(global.status()).toBeLessThan(500);
    // 303 was added in Phase 3: a callback carrying nothing the server can
    // exchange is an implicit-flow confirmation whose session sits in the URL
    // fragment, so the handler delegates to a browser page that can read it.
    expect([200, 303, 307, 308]).toContain(global.status());
    // Whatever it answers, it must never bounce into a locale-prefixed copy
    // of itself.
    const location = global.headers().location ?? "";
    expect(location).not.toMatch(/\/(en|ar)\/auth\/callback/);

    // The locale-prefixed variant must NOT exist.
    const localized = await rawResponse(page, "/ar/auth/callback");
    expect(localized.status()).toBe(404);
  });
});
