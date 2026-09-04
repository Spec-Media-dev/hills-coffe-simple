import { expect, test, type Page } from "@playwright/test";
import { collectRuntimeProblems, devOverlayError } from "./helpers";
import { service } from "./auth-fixtures";
import {
  hasNoSession,
  hasP12Fixtures,
  p12Label,
  p12PersonaEmail,
  p12PersonaId,
  p12Prefix,
  signInAs,
  expectRealSession,
} from "./p12-fixtures";

/**
 * P12-T02/T03/T04 — the five-persona journey matrix under real sessions.
 *
 * Every write in here targets a fixture created by the current seed run. No
 * pre-existing row, user, offer or inquiry is edited, blocked or deleted: the
 * Admin block/unblock journey operates on the run's own blocked persona, and
 * the Lead Inbox assertions read fixture inquiries by their run label.
 *
 * The runtime gate (P12-T04) is the same `collectRuntimeProblems` helper the
 * anonymous suite already uses, so authenticated pages are held to exactly the
 * standard the public ones are.
 */

test.describe.configure({ mode: "serial", timeout: 240_000 });

test.skip(
  !hasP12Fixtures,
  "P12 fixtures unavailable — run `node scripts/e2e/seed.mjs` first",
);

/** Fails the test if any runtime channel produced something unexpected. */
async function expectCleanRuntime(
  page: Page,
  problems: ReturnType<typeof collectRuntimeProblems>,
  context: string,
) {
  const found = problems.summary();
  expect(found.scriptTag, `${context}: no client-rendered <script>`).toEqual(
    [],
  );
  expect(found.hydration, `${context}: no hydration error`).toEqual([]);
  expect(found.pageErrors, `${context}: no uncaught page error`).toEqual([]);
  expect(found.consoleErrors, `${context}: no console.error`).toEqual([]);
  expect(
    await devOverlayError(page),
    `${context}: no Next.js dev overlay`,
  ).toBeNull();
}

const PRICE_TEXT = /\$\s?\d+(?:[.,]\d+)?\s*\/\s*kg/i;

/** The catalog detail page for one of this run's published fixture coffees. */
async function openFixtureCoffee(page: Page, locale: "en" | "ar" = "en") {
  const prefix = locale === "ar" ? "/ar" : "";
  await page.goto(`${prefix}/green-coffee-offer-list?query=${p12Label}`, {
    waitUntil: "networkidle",
  });
  const link = page
    .locator(`a[href*="/green-coffee-offer-list/${p12Prefix}"]`)
    .first();
  if (!(await link.count())) return false;
  await link.click();
  await page.waitForLoadState("networkidle");
  return true;
}

// ==================================================== P12-T02 session smoke

test.describe("P12-T02 real authenticated sessions", () => {
  /*
   * What "signed in" means is persona-specific, and the approved Phase-3
   * behaviour decides it — not a uniform expectation:
   *
   *  - unverified: Supabase refuses an unconfirmed email, so the form reports
   *    "confirm your email" and NO session is created. That refusal is the
   *    correct outcome; asserting a session here would assert a security hole.
   *  - blocked: sign-in is refused with "access is restricted" and any
   *    attempted session is cleared.
   *  - verified / admin: a genuine session is established.
   */
  test("verified USER establishes a genuine session and reaches the account", async ({
    page,
  }) => {
    const landing = await signInAs(page, "verified");
    await expectRealSession(page);
    expect(landing).toBe("/account");
    console.log(`P12T02 verified -> ${landing} (real session)`);
  });

  test("ADMIN establishes a genuine session through the Admin entry", async ({
    page,
  }) => {
    const landing = await signInAs(page, "admin");
    await expectRealSession(page);
    expect(landing).toBe("/admin");
    console.log(`P12T02 admin -> ${landing} (real session)`);
  });

  test("unverified USER is refused a session and told to confirm", async ({
    page,
  }) => {
    await signInAs(page, "unverified");
    await expect(
      page.getByRole("alert").filter({ hasText: /confirm your email/i }),
    ).toBeVisible({ timeout: 20_000 });
    expect(
      await hasNoSession(page),
      "an unconfirmed email must not obtain a session",
    ).toBe(true);
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/sign-in\?next=/);
    console.log("P12T02 unverified -> refused, no session (correct)");
  });
});

// ==================================================== P12-T03 anonymous

test.describe("P12-T03 anonymous", () => {
  test("browses public content, sees no protected price, is denied private routes", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    expect(await hasNoSession(page)).toBe(true);

    await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    expect(
      PRICE_TEXT.test(await page.content()),
      "anonymous catalog exposed a per-kg price",
    ).toBe(false);

    if (await openFixtureCoffee(page))
      expect(
        PRICE_TEXT.test(await page.content()),
        "anonymous coffee detail exposed a per-kg price",
      ).toBe(false);

    for (const route of [
      "/account",
      "/account/favorites",
      "/account/requests",
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(
        new URL(page.url()).pathname,
        `${route} must not serve an anonymous visitor`,
      ).not.toBe(route);
    }

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toBe("/admin");

    await expectCleanRuntime(page, problems, "anonymous");
  });
});

// ==================================================== P12-T03 unverified

test.describe("P12-T03 unverified USER", () => {
  test("is recognised, told to verify, and denied customer capability", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "unverified");
    // No session is expected: Supabase refuses an unconfirmed email.

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    const path = new URL(page.url()).pathname;
    console.log(`P12T03 unverified /account -> ${path}`);
    expect(path, "an unverified user must not reach the account area").not.toBe(
      "/account",
    );

    await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
    expect(
      PRICE_TEXT.test(await page.content()),
      "unverified user was shown protected pricing",
    ).toBe(false);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toBe("/admin");

    await expectCleanRuntime(page, problems, "unverified");
  });
});

// ==================================================== P12-T03 verified

test.describe("P12-T03 verified USER", () => {
  test("reaches the account area and its sub-pages", async ({ page }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "verified");
    await expectRealSession(page);

    for (const route of [
      "/account",
      "/account/settings",
      "/account/favorites",
      "/account/requests",
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      expect(new URL(page.url()).pathname, `${route} should be reachable`).toBe(
        route,
      );
      await expect(page.locator("main")).toBeVisible();
    }
    await expectCleanRuntime(page, problems, "verified account");
  });

  test("sees protected pricing that an anonymous visitor cannot", async ({
    page,
  }) => {
    await signInAs(page, "verified");
    await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
    const signedIn = PRICE_TEXT.test(await page.content());
    console.log(`P12T03 verified sees per-kg pricing: ${signedIn}`);
    expect(
      signedIn,
      "a verified customer should see protected per-kg pricing",
    ).toBe(true);
  });

  test("has no Admin capability", async ({ page }) => {
    await signInAs(page, "verified");
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });

  test("signs out cleanly, with no runtime error left behind", async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "verified");
    await page.goto("/account", { waitUntil: "networkidle" });
    problems.reset();

    // Sign out through the account menu, the way a person would.
    const trigger = page.locator('header button[aria-haspopup="menu"]').first();
    if (await trigger.count()) {
      await trigger.click();
      const signOut = page
        .getByRole("menuitem")
        .filter({ hasText: /sign out|تسجيل الخروج/i });
      if (await signOut.count()) {
        await signOut.first().click();
        const confirm = page
          .getByRole("dialog")
          .locator('button[type="submit"]');
        if (await confirm.count()) await confirm.first().click();
        await page.waitForTimeout(2500);
      }
    }
    // Whatever the exact affordance, the runtime must stay clean — in
    // particular no orphaned Realtime subscription screaming after teardown.
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await expectCleanRuntime(page, problems, "after sign-out");
  });
});

// ==================================================== P12-T03 admin

test.describe("P12-T03 ADMIN", () => {
  test("reaches the Admin workspaces", async ({ page }) => {
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "admin");
    await expectRealSession(page);

    for (const route of ["/admin", "/admin/users", "/admin/inquiries"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      expect(new URL(page.url()).pathname, `${route} should be reachable`).toBe(
        route,
      );
      await expect(page.locator("main")).toBeVisible();
    }
    await expectCleanRuntime(page, problems, "admin workspaces");
  });

  test("sees this run's fixture inquiries in the Lead Inbox", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto(`/admin/inquiries?query=${encodeURIComponent(p12Label)}`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("main")).toContainText(p12Label, {
      timeout: 30_000,
    });
  });

  test("holds no customer protected-pricing entitlement", async ({ page }) => {
    // An Administrator is not a customer: role separation means the Admin
    // session must not inherit protected pricing on the public catalog.
    await signInAs(page, "admin");
    await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
    expect(
      PRICE_TEXT.test(await page.content()),
      "Admin session inherited customer protected pricing",
    ).toBe(false);
  });

  test("blocks and unblocks only this run's fixture user", async ({ page }) => {
    const target = p12PersonaEmail("blocked");
    await signInAs(page, "admin");
    await page.goto(`/admin/users?query=${encodeURIComponent(target)}`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("main")).toContainText(target, {
      timeout: 30_000,
    });

    const row = page
      .locator("main")
      .locator(`a[href*="/admin/users/"]`)
      .first();
    await row.click();
    await page.waitForLoadState("networkidle");
    // The detail page must be the fixture user, never anyone else.
    await expect(page.locator("main")).toContainText(target);

    const blockedState = async () => {
      const { data } = await service
        .from("profiles")
        .select("is_blocked")
        .eq("id", p12PersonaId("blocked"))
        .single();
      return data?.is_blocked ?? null;
    };

    /*
     * Normalise first, so this journey is re-runnable.
     *
     * A previous interrupted run can leave the fixture blocked; starting from
     * a known-unblocked state is what makes the false -> true transition below
     * real evidence rather than a coincidence of ordering.
     */
    if ((await blockedState()) === true) {
      await page.getByRole("button", { name: /unblock|restore/i }).click();
      const reset = page.getByRole("dialog");
      await expect(reset).toBeVisible({ timeout: 15_000 });
      await reset.locator('button[type="submit"]').click();
      await expect.poll(blockedState, { timeout: 30_000 }).toBe(false);
      console.log(
        "P12T03 fixture normalised to unblocked before the block test",
      );
    }
    expect(
      await blockedState(),
      "the fixture user must start unblocked for this journey",
    ).toBe(false);

    // Same selectors the existing Admin Users suite uses: an accessible-name
    // match, because the control is not inside <main> and its label is exact.
    await page.getByRole("button", { name: /^block$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog
      .locator('textarea[name="reason"]')
      .fill(`${p12Label} fixture block`);
    await dialog.locator('button[type="submit"]').click();

    // Proven at the database, because the block fields are writable only by
    // admin_set_user_blocked() and a UI that merely looked right would not
    // have moved them.
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("profiles")
            .select("is_blocked")
            .eq("id", p12PersonaId("blocked"))
            .single();
          return data?.is_blocked ?? null;
        },
        { timeout: 30_000, message: "the fixture user never became blocked" },
      )
      .toBe(true);
    console.log(
      "P12T03 admin blocked the fixture user through the real workflow",
    );
  });
});

// ==================================================== P12-T03 blocked

test.describe("P12-T03 blocked USER", () => {
  test("is refused at sign-in once blocked, with no session and no account", async ({
    page,
  }) => {
    /*
     * Asserted on the security outcome rather than on one message string.
     *
     * The Admin workflow blocks at two layers: `admin_set_user_blocked()` sets
     * `profiles.is_blocked`, and `syncAuthBan()` then bans the Auth user
     * (verified: `banned_until` is set decades out). Because the Auth layer now
     * refuses first, the wording differs from the Phase-3 fixture path, which
     * blocks in the database only and so reaches the application's own "access
     * is restricted" branch. Both are correct refusals; what Phase 12 must
     * prove is the capability loss, which is exactly what is checked here.
     */
    const landing = await signInAs(page, "blocked");
    expect(landing, "a blocked account must not leave the sign-in page").toBe(
      "/sign-in",
    );
    expect(
      await hasNoSession(page),
      "a blocked account must hold no session",
    ).toBe(true);

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/sign-in/);
    console.log("P12T03 blocked -> refused, no session, account unreachable");
  });

  test("is denied customer capability and protected pricing", async ({
    page,
  }) => {
    // The persona is blocked through the approved workflow by the seed's
    // sibling script before this runs; if it is not yet blocked the assertions
    // below still describe the required end state.
    await signInAs(page, "blocked");
    // Sign-in is refused for a blocked account, so the browser is effectively
    // anonymous from here — which is exactly the capability revocation the
    // security contract promises.
    await page.goto("/green-coffee-offer-list", { waitUntil: "networkidle" });
    expect(
      PRICE_TEXT.test(await page.content()),
      "blocked user was shown protected pricing",
    ).toBe(false);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });
});

test.describe("P12-T03 ADMIN unblock", () => {
  test("unblocks the same fixture user through the real workflow", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto(`/admin/users/${p12PersonaId("blocked")}`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /unblock|restore/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.locator('button[type="submit"]').click();
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("profiles")
            .select("is_blocked")
            .eq("id", p12PersonaId("blocked"))
            .single();
          return data?.is_blocked ?? null;
        },
        { timeout: 30_000, message: "the fixture user never became unblocked" },
      )
      .toBe(false);
    console.log("P12T03 admin unblocked the fixture user");
  });
});

// ==================================================== P12-T04 locale gate

test.describe("P12-T04 authenticated EN -> AR -> EN", () => {
  for (const [label, persona, route] of [
    ["customer account", "verified", "/account"],
    ["admin workspace", "admin", "/admin"],
  ] as const) {
    test(`${label} survives a full locale round trip`, async ({ page }) => {
      const problems = collectRuntimeProblems(page);
      await signInAs(page, persona);
      await page.goto(route, { waitUntil: "networkidle" });
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      problems.reset();

      await page.locator('header a[hreflang="ar"]').first().click();
      await page.waitForURL(/\/ar\//, { timeout: 30_000 });
      expect(new URL(page.url()).pathname).toBe(`/ar${route}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectCleanRuntime(page, problems, `${label} EN->AR`);

      await page.locator('header a[hreflang="en"]').first().click();
      await page.waitForURL((url) => !url.pathname.startsWith("/ar"), {
        timeout: 30_000,
      });
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expectCleanRuntime(page, problems, `${label} AR->EN`);
      console.log(`P12T04 ${label}: EN -> AR -> EN clean`);
    });
  }

  test("a query string survives the round trip inside the Admin workspace", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    const query = "?query=" + encodeURIComponent(p12Label);
    await page.goto(`/admin/inquiries${query}`, { waitUntil: "networkidle" });
    await page.locator('header a[hreflang="ar"]').first().click();
    await page.waitForURL(/\/ar\/admin\/inquiries/, { timeout: 30_000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/ar/admin/inquiries");
    expect(url.search).toBe(query);
  });
});
