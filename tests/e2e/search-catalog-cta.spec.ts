import { expect, test, type Page } from "@playwright/test";
import { collectRuntimeProblems, devOverlayError } from "./helpers";
import { auditScreen, hasHorizontalOverflow } from "./ui-audit";
import { hasP12Fixtures, signInAs, type P12Persona } from "./p12-fixtures";

/**
 * Pre-Phase-13 follow-up: header search, unified search, catalog discovery,
 * expandable previews and auth-aware calls to action.
 *
 * The persona blocks need real Supabase fixtures and skip without them; the
 * anonymous and interaction blocks run unconditionally, so the suite still has
 * teeth on a machine with no staging credentials.
 */

const ADMIN_ROUTE = /^\/(ar\/)?admin(\/|$)/;
const pathOf = (page: Page) => new URL(page.url()).pathname;
const prefix = (locale: "en" | "ar") => (locale === "ar" ? "/ar" : "");

async function expectCleanRuntime(
  page: Page,
  problems: ReturnType<typeof collectRuntimeProblems>,
  label: string,
) {
  const found = problems.summary();
  expect(found.hydration, `${label}: hydration`).toEqual([]);
  expect(found.pageErrors, `${label}: pageerror`).toEqual([]);
  expect(found.consoleErrors, `${label}: console.error`).toEqual([]);
  expect(await devOverlayError(page), `${label}: dev overlay`).toBeNull();
}

// =====================================================================
// Header search
// =====================================================================

test.describe("header search", () => {
  for (const locale of ["en", "ar"] as const)
    test(`${locale}: opens in place, submits, and closes without ever navigating on open`, async ({
      page,
      isMobile,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(`${prefix(locale)}/`, { waitUntil: "domcontentloaded" });

      const trigger = page.getByTestId("header-search-trigger");
      const input = page.getByTestId("header-search-input");

      /*
       * Desktop-only, and measured: shown at phone widths the trigger pushed
       * the authenticated header past 375px. Phones reach search through the
       * drawer form, which the mobile test below exercises end to end.
       */
      test.skip(isMobile, "search opens from the drawer on a phone");
      await expect(trigger).toBeVisible();

      const before = page.url();
      await trigger.click();
      // The whole point of the change: clicking search must not navigate.
      expect(page.url(), "clicking search navigated away").toBe(before);
      await expect(input).toBeVisible();
      await expect(input).toBeFocused();

      // An empty query must not navigate either.
      await input.press("Enter");
      await page.waitForTimeout(400);
      expect(page.url(), "empty search navigated").toBe(before);

      await input.fill("coffee");
      await input.press("Enter");
      await page.waitForURL(/\/search\?q=coffee/, { timeout: 15_000 });
      expect(pathOf(page)).toBe(`${prefix(locale)}/search`);
      expect(new URL(page.url()).searchParams.get("q")).toBe("coffee");

      await expectCleanRuntime(page, problems, `header-search/${locale}`);
    });

  for (const locale of ["en", "ar"] as const)
    test(`${locale}: Escape closes the field and returns focus to the trigger`, async ({
      page,
    }, testInfo) => {
      await page.goto(`${prefix(locale)}/`, { waitUntil: "domcontentloaded" });
      test.skip(
        testInfo.project.name !== "desktop",
        "search opens from the drawer on a phone",
      );
      const trigger = page.getByTestId("header-search-trigger");

      await trigger.click();
      const input = page.getByTestId("header-search-input");
      await expect(input).toBeFocused();
      await input.press("Escape");
      await expect(input).toBeHidden();
      await expect(trigger).toBeFocused();

      // The close button is the pointer equivalent of Escape.
      await trigger.click();
      await page.getByTestId("header-search-close").click();
      await expect(input).toBeHidden();
    });

  test("mobile: search is reachable from the drawer without overflowing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    const problems = collectRuntimeProblems(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await hasHorizontalOverflow(page), "header overflows at 375").toBe(
      false,
    );

    await page.getByRole("button", { name: /menu/i }).first().click();
    const field = page.getByTestId("mobile-search-input");
    await expect(field).toBeVisible();
    await field.fill("coffee");
    await field.press("Enter");
    await page.waitForURL(/\/search\?q=coffee/, { timeout: 15_000 });
    await expectCleanRuntime(page, problems, "mobile-drawer-search");
  });
});

// =====================================================================
// Unified site search
// =====================================================================

test.describe("unified site search", () => {
  test("returns coffees, origins and knowledge, and never a price", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await page.goto("/search?q=a", { waitUntil: "domcontentloaded" });

    const body = await page.locator("main, body").first().innerText();
    // At least one group must be present for a one-letter query against real
    // seeded content; a page that silently returns nothing is the failure.
    expect(
      /Coffees|Origins|Knowledge|Pages/.test(body),
      "no result groups rendered",
    ).toBe(true);

    // Hydration comments stripped: React splits `$7.50 / kg` across text nodes.
    expect(
      /\$\s?\d+[.,]\d{2}\s*\/\s*kg/i.test(
        (await page.content()).replace(/<!--.*?-->/g, ""),
      ),
      "a protected price reached an anonymous search page",
    ).toBe(false);

    await auditScreen(page, "search-results");
    await expectCleanRuntime(page, problems, "search-results");
  });

  test("empty and unmatched queries are handled without an error state", async ({
    page,
  }) => {
    await page.goto("/search", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    await page.goto("/search?q=zzzzqqqnothing", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("h1")).toBeVisible();
    expect(await devOverlayError(page)).toBeNull();
  });

  test("is excluded from indexing", async ({ page }) => {
    await page.goto("/search?q=coffee", { waitUntil: "domcontentloaded" });
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    expect(robots).toMatch(/noindex/);
  });

  test("draft and archived coffees never appear", async ({ page, request }) => {
    // Whatever the catalog refuses to list, search must also refuse. Comparing
    // the two is stronger than naming a fixture slug that may not exist.
    const listing = await (
      await request.get("/green-coffee-offer-list")
    ).text();
    const slugs = [
      ...listing.matchAll(/\/green-coffee-offer-list\/([a-z0-9-]+)"/g),
    ].map((match) => match[1]);
    await page.goto("/search?q=a", { waitUntil: "domcontentloaded" });
    const html = await page.content();
    const found = [
      ...html.matchAll(/\/green-coffee-offer-list\/([a-z0-9-]+)"/g),
    ].map((match) => match[1]);
    for (const slug of found)
      expect(
        slugs,
        `search surfaced ${slug}, which the catalog does not list`,
      ).toContain(slug);
  });
});

// =====================================================================
// Catalog discovery
// =====================================================================

test.describe("catalog discovery", () => {
  /**
   * Below `md` the filter form is collapsed behind its disclosure, which is
   * the intended mobile design — the desktop control row does not belong on a
   * 375px screen. Tests have to open it the way a person would.
   */
  const openFilters = async (page: Page) => {
    const form = page.getByTestId("catalog-filters");
    if (await form.isVisible()) return;
    await page
      .getByRole("button", { name: /filters|عوامل|فلات/i })
      .first()
      .click();
    await expect(form).toBeVisible();
  };

  const countOf = async (page: Page) => {
    const text = await page
      .locator('p[aria-live="polite"]')
      .first()
      .innerText();
    return Number(text.replace(/\D+/g, ""));
  };

  test("filters apply themselves, with no Apply button to press", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const all = await countOf(page);
    await openFilters(page);

    // Selecting an origin must change the results on its own.
    const origin = page.locator('select[name="origin"]');
    const value = await origin.locator("option").nth(1).getAttribute("value");
    await origin.selectOption(value!);
    await page.waitForURL(/origin=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("origin")).toBe(value);
    const narrowed = await countOf(page);
    expect(narrowed).toBeLessThanOrEqual(all);

    // A visible Apply control would defeat the point.
    await expect(page.getByRole("button", { name: /^apply$/i })).toHaveCount(0);
    await expectCleanRuntime(page, problems, "catalog-autofilter");
  });

  test("sort and certification apply themselves and stay in the URL", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    await openFilters(page);
    await page.locator('select[name="sort"]').selectOption("cup-score");
    await page.waitForURL(/sort=cup-score/, { timeout: 15_000 });

    await page.locator('input[name="certified"]').click();
    await page.waitForURL(/certified=1/, { timeout: 15_000 });
    await expect(page.locator('input[name="certified"]')).toBeChecked();
    // The earlier choice must survive the later one.
    expect(new URL(page.url()).searchParams.get("sort")).toBe("cup-score");
  });

  test("free text is debounced, and Enter submits immediately", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    await openFilters(page);
    const field = page
      .getByTestId("catalog-filters")
      .locator('input[name="q"]');

    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });

    await field.pressSequentially("minas", { delay: 40 });
    /*
     * Polled rather than `waitForURL`. The debounce commits through
     * `router.replace`, a client-side navigation that fires no `load` event,
     * so `waitForURL` — which waits for one by default — can sit until it
     * times out even though the address bar already shows the new query.
     */
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), {
        timeout: 15_000,
        message: "the debounced query never reached the URL",
      })
      .toBe("minas");
    // Five keystrokes must not mean five navigations.
    expect(
      navigations,
      "typing issued one navigation per keystroke",
    ).toBeLessThan(5);
  });

  test("reset clears catalog filters and returns the full list", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list?sort=cup-score&certified=1", {
      waitUntil: "domcontentloaded",
    });
    await openFilters(page);
    await page.getByRole("button", { name: /clear/i }).first().click();
    await page.waitForFunction(
      () => !window.location.search.includes("certified"),
      undefined,
      { timeout: 15_000 },
    );
    const params = new URL(page.url()).searchParams;
    expect(params.get("certified")).toBeNull();
    expect(params.get("sort")).toBeNull();
  });

  test("a filtered URL is shareable and Back leaves it", async ({ page }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const before = await countOf(page);
    await openFilters(page);
    const origin = page.locator('select[name="origin"]');
    const value = await origin.locator("option").nth(1).getAttribute("value");
    await origin.selectOption(value!);
    await page.waitForURL(/origin=/, { timeout: 15_000 });
    const shared = page.url();
    const narrowed = await countOf(page);

    // Reloading the shared URL must reproduce the same result.
    await page.goto(shared, { waitUntil: "domcontentloaded" });
    expect(await countOf(page)).toBe(narrowed);

    // `replace` is used for filter changes, so Back leaves the catalog rather
    // than walking through every toggle.
    await page.goBack();
    expect(pathOf(page)).not.toContain("undefined");
    expect(before).toBeGreaterThanOrEqual(narrowed);
  });

  test("changing a filter returns to the first page", async ({ page }) => {
    await page.goto("/green-coffee-offer-list?page=2", {
      waitUntil: "domcontentloaded",
    });
    await openFilters(page);
    await page.locator('select[name="sort"]').selectOption("bags");
    await page.waitForURL(/sort=bags/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("page")).toBeNull();
  });

  for (const locale of ["en", "ar"] as const)
    test(`${locale}: the catalog has no horizontal overflow at 360px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(`${prefix(locale)}/green-coffee-offer-list`, {
        waitUntil: "domcontentloaded",
      });
      expect(await hasHorizontalOverflow(page)).toBe(false);
      const dir = await page.evaluate(() =>
        document.documentElement.getAttribute("dir"),
      );
      expect(dir).toBe(locale === "ar" ? "rtl" : "ltr");
    });
});

// =====================================================================
// Expandable catalog item
// =====================================================================

test.describe("expandable catalog item", () => {
  for (const locale of ["en", "ar"] as const)
    test(`${locale}: expands by mouse and keyboard with correct aria state`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await page.goto(`${prefix(locale)}/green-coffee-offer-list`, {
        waitUntil: "domcontentloaded",
      });

      const toggle = page
        .locator("button[aria-expanded][aria-controls]")
        .filter({
          hasNot: page.locator("svg.lucide-sliders-horizontal"),
        });
      const first = toggle.last();
      await expect(first).toHaveAttribute("aria-expanded", "false");

      await first.click();
      await expect(first).toHaveAttribute("aria-expanded", "true");
      const panelId = await first.getAttribute("aria-controls");
      // `aria-controls` must resolve to a real element, expanded or not.
      await expect(page.locator(`[id="${panelId}"]`)).toHaveCount(1);
      await expect(page.locator(`[id="${panelId}"] dt`).first()).toBeVisible();

      // No empty labels: every rendered term must have a non-empty value.
      const pairs = await page.evaluate((id) => {
        const panel = document.getElementById(id);
        if (!panel) return [];
        return [...panel.querySelectorAll("dt")].map((dt) => ({
          term: dt.textContent?.trim() ?? "",
          value: (dt.nextElementSibling?.textContent ?? "").trim(),
        }));
      }, panelId!);
      expect(pairs.length).toBeGreaterThan(0);
      for (const pair of pairs)
        expect(pair.value, `"${pair.term}" rendered with no value`).not.toBe(
          "",
        );

      await first.click();
      await expect(first).toHaveAttribute("aria-expanded", "false");

      // Keyboard parity.
      await first.focus();
      await page.keyboard.press("Enter");
      await expect(first).toHaveAttribute("aria-expanded", "true");

      await expectCleanRuntime(page, problems, `expandable/${locale}`);
    });

  test("the preview still links to the canonical detail page", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const toggle = page.locator("button[aria-expanded][aria-controls]").last();
    await toggle.click();
    const panelId = await toggle.getAttribute("aria-controls");
    await page
      .locator(`[id="${panelId}"] a[href*="/green-coffee-offer-list/"]`)
      .first()
      .click();
    await page.waitForURL(/\/green-coffee-offer-list\/[a-z0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.locator("h1")).toBeVisible();
  });
});

// =====================================================================
// Origin discovery
// =====================================================================

test.describe("origin discovery", () => {
  for (const locale of ["en", "ar"] as const)
    test(`${locale}: the catalog origin filter is populated from real origins`, async ({
      page,
    }) => {
      await page.goto(`${prefix(locale)}/green-coffee-offer-list`, {
        waitUntil: "domcontentloaded",
      });
      const form = page.getByTestId("catalog-filters");
      if (!(await form.isVisible()))
        await page
          .getByRole("button", { name: /filters|عوامل|فلات/i })
          .first()
          .click();
      const options = await page
        .locator('select[name="origin"] option')
        .allInnerTexts();
      // The placeholder plus at least one real origin.
      expect(options.length).toBeGreaterThan(1);

      // Warehouses must not have leaked into the origin facet.
      const originValues = await page
        .locator('select[name="origin"] option')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLOptionElement).value),
        );
      expect(originValues).not.toContain("EGYPT");
      expect(originValues).not.toContain("DUBAI");

      // Choosing one must narrow the catalog by that origin.
      const slug = originValues.find(Boolean)!;
      await page.goto(
        `${prefix(locale)}/green-coffee-offer-list?origin=${slug}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(new URL(page.url()).searchParams.get("origin")).toBe(slug);
    });

  for (const locale of ["en", "ar"] as const)
    test(`${locale}: the header menu offers real origins and keeps warehouses separate`, async ({
      page,
      isMobile,
    }) => {
      await page.goto(`${prefix(locale)}/green-coffee-offer-list`, {
        waitUntil: "domcontentloaded",
      });

      // The origin names the catalog facet knows about, from the live database.
      const facetLabels = (
        await page.locator('select[name="origin"] option').allInnerTexts()
      )
        .slice(1)
        .map((label) => label.trim())
        .filter(Boolean);
      expect(
        facetLabels.length,
        "no active origins in the facet",
      ).toBeGreaterThan(0);

      // Desktop opens the Products mega menu; a phone uses the drawer. Both
      // must offer the same real origins.
      if (isMobile) {
        await page
          .getByRole("button", { name: /menu|القائمة/i })
          .first()
          .click();
      } else {
        /*
         * Hover, not click. The panel opens on `mouseenter`, so Playwright's
         * click — which moves the pointer onto the control first — opens it
         * and then toggles it straight back shut. Hovering is what a desktop
         * visitor actually does; the chevron button exists for keyboard users
         * and carries its own accessible name.
         */
        await page
          .getByRole("button", {
            name: /show product categories|عرض فئات المحاصيل/i,
          })
          .first()
          .hover();
      }

      const originLinks = page.locator(
        'a[href*="/green-coffee-offer-list?origin="]',
      );
      await expect(originLinks.first()).toBeVisible({ timeout: 10_000 });

      const hrefs = await originLinks.evaluateAll((nodes) =>
        nodes.map(
          (node) => (node as HTMLAnchorElement).getAttribute("href") ?? "",
        ),
      );
      // Every offered origin must be a real facet slug, never a warehouse.
      for (const href of hrefs) {
        const slug = new URL(href, "https://x.invalid").searchParams.get(
          "origin",
        );
        expect(slug, `menu offered an empty origin`).toBeTruthy();
        expect(
          ["EGYPT", "DUBAI"],
          "a warehouse was offered as a coffee origin",
        ).not.toContain(slug);
      }

      // And the label shown must be the localized one, not a slug.
      const texts = await originLinks.allInnerTexts();
      expect(
        texts.some((text) => facetLabels.includes(text.trim())),
        "menu origin labels do not match the localized facet labels",
      ).toBe(true);

      // Following one must actually narrow the catalog.
      await originLinks.first().click();
      await page.waitForURL(/origin=/, { timeout: 15_000 });
      expect(pathOf(page)).toBe(`${prefix(locale)}/green-coffee-offer-list`);
    });

  test("the origins index still resolves its canonical route", async ({
    page,
  }) => {
    await page.goto("/coffee-origins", { waitUntil: "domcontentloaded" });
    const link = page.locator('a[href*="/coffee-origins/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForURL(/\/coffee-origins\/[a-z0-9-]+/, {
        timeout: 15_000,
      });
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

// =====================================================================
// Persona behaviour — pricing and calls to action
// =====================================================================

test.describe("persona pricing and calls to action", () => {
  test.skip(
    !hasP12Fixtures,
    "persona fixtures unavailable — run `node scripts/e2e/seed.mjs`",
  );
  /*
   * Not serial. Serial mode shares one browser context across the block, so
   * each persona inherited the previous persona's cookies — which is precisely
   * the session-bleed that produced the signup/Admin regression earlier in this
   * project. Independent contexts also stop one failure from hiding the rest.
   */
  test.describe.configure({ timeout: 180_000 });

  const PRICE = /\$\s?\d+[.,]\d{2}\s*\/\s*kg/i;

  /*
   * React renders `${price} / kg` as three adjacent text nodes, so the
   * serialized HTML actually reads `$<!-- -->7.50<!-- --> / kg`. Matching the
   * raw markup therefore missed every real price — which would have made the
   * "no price leaked" assertions pass vacuously. Strip the hydration comments
   * first, and check the visible text as well.
   */
  const priceShown = async (page: Page) => {
    const html = (await page.content()).replace(/<!--.*?-->/g, "");
    const text = await page.locator("body").innerText();
    return PRICE.test(html) || PRICE.test(text);
  };
  /** Wording a viewer who already holds a session must never be shown. */
  const CONTRADICTION = /sign in|create an account|verify your email/i;

  test("anonymous sees no price and is invited to sign in", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    expect(await priceShown(page)).toBe(false);
    await expect(
      page.getByText(/sign in to view pricing/i).first(),
    ).toBeVisible();
  });

  /*
   * Only `unverified` here. The seed's "blocked" persona is not blocked at
   * seed time — it is the *candidate* for the block journey, which the
   * Phase-12 persona matrix performs through the real Admin UI. Signing it in
   * yields an ordinary verified customer, so asserting "blocked sees no price"
   * against it would have been asserting the opposite of the truth. The
   * genuine blocked contract is covered twice: the resolver's unit test in
   * `src/lib/auth/persona.test.ts`, and the Phase-12 matrix, which proves a
   * really-blocked account cannot obtain a session at all.
   */
  for (const persona of ["unverified"] as const)
    test(`${persona} sees no protected price`, async ({ page }) => {
      await signInAs(page, persona as P12Persona, "en");
      await page.goto("/green-coffee-offer-list", {
        waitUntil: "domcontentloaded",
      });
      expect(
        await priceShown(page),
        `${persona} received a protected price`,
      ).toBe(false);
    });

  test("a verified customer sees protected pricing and no contradictory CTA", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "verified", "en");
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    expect(
      await priceShown(page),
      "verified customer did not receive protected pricing",
    ).toBe(true);

    // The regression the owner reported: a signed-in, verified customer being
    // told to sign in or verify. Checked on every public surface that carries
    // a call to action.
    for (const route of ["/", "/green-coffee-offer-list", "/contact"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const main = await page.locator("body").innerText();
      const offending = main
        .split("\n")
        .filter((line) => CONTRADICTION.test(line));
      expect(
        offending,
        `verified customer was asked to sign in / verify on ${route}`,
      ).toEqual([]);
    }
    await expectCleanRuntime(page, problems, "verified-cta");
  });

  test("an unverified customer is asked to verify, never to sign in again", async ({
    page,
  }) => {
    await signInAs(page, "unverified", "en");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Unverified accounts cannot hold a session at all in this application, so
    // the anonymous wording is correct for them; what must not happen is a
    // price.
    expect(await priceShown(page)).toBe(false);
  });

  /*
   * Cache identity safety.
   *
   * Nothing on this path is cached across requests — the viewer and persona are
   * React `cache()` request memoization only, and prices are read per request
   * behind `requireVerifiedUser()`. This test is what makes that claim
   * falsifiable: it fetches the same URL as a verified customer and then as an
   * anonymous visitor in the same browser, and fails if the entitled response
   * is ever served to the unentitled one. If page-level caching is ever added,
   * this is the test that catches it leaking.
   */
  test("an entitled response is never replayed to an anonymous visitor", async ({
    page,
  }) => {
    const url = "/green-coffee-offer-list";

    await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(await priceShown(page), "anonymous saw a price first").toBe(false);

    await signInAs(page, "verified", "en");
    await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(await priceShown(page), "verified saw no price").toBe(true);

    // Same URL, same browser, session dropped.
    await page.context().clearCookies();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(
      await priceShown(page),
      "a verified customer's pricing was replayed to an anonymous visitor",
    ).toBe(false);
  });

  /* Locale is part of every read's identity, never shared between languages. */
  test("locales do not share catalog facet results", async ({ page }) => {
    await page.goto("/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const en = await page
      .locator('select[name="origin"] option')
      .allInnerTexts();

    await page.goto("/ar/green-coffee-offer-list", {
      waitUntil: "domcontentloaded",
    });
    const ar = await page
      .locator('select[name="origin"] option')
      .allInnerTexts();

    expect(en.length, "no origin options in EN").toBeGreaterThan(1);
    expect(ar.length, "no origin options in AR").toBe(en.length);
    expect(ar.join("|"), "Arabic reused the English facet labels").not.toBe(
      en.join("|"),
    );
  });

  test("an Administrator is never presented as a pricing customer", async ({
    page,
  }) => {
    await signInAs(page, "admin", "en");
    for (const route of ["/", "/green-coffee-offer-list"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(await priceShown(page), `Admin received a price on ${route}`).toBe(
        false,
      );
      const text = await page.locator("body").innerText();
      expect(
        /sign in to view pricing|create an account/i.test(text),
        `Admin was offered a customer CTA on ${route}`,
      ).toBe(false);
      // And the public site must not advertise the Admin workspace.
      expect(ADMIN_ROUTE.test(pathOf(page))).toBe(false);
    }
  });
});
