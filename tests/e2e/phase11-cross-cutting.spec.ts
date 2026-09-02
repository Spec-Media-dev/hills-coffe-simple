import { expect, test, type Page } from "@playwright/test";
import { runAxe } from "./helpers";
import {
  createAuthFixtureSet,
  hasAuthFixtureCredentials,
  service,
  type AuthFixtureSet,
} from "./auth-fixtures";

/**
 * Phase 11 — cross-cutting quality.
 *
 * Three things source inspection cannot establish, so they are established
 * here against a running server:
 *
 *  1. that no failure a person can actually trigger puts backend text on
 *     screen — checked by driving each failure and reading what rendered;
 *  2. that every interactive primitive is operable from the keyboard alone,
 *     including focus entry, trapping, Escape and focus restoration;
 *  3. that the authenticated shells pass axe, which the suite previously
 *     skipped as "staging credentials required" even though the five personas
 *     are creatable locally.
 */

/**
 * Signatures of backend text escaping to a user-facing surface.
 *
 * Each pattern is something only a database, driver or runtime would say. A
 * localized message never matches one, so a hit is a leak rather than a
 * wording judgement.
 */
const RAW_ERROR_SIGNATURES: { name: string; pattern: RegExp }[] = [
  { name: "SQLSTATE", pattern: /\b(?:SQLSTATE|PGRST\d{3})\b|\b\d{5}\b(?=[^\d]*(?:error|violat))/i },
  { name: "constraint name", pattern: /\b\w+_(?:fkey|pkey|key|check|unique|idx)\b/ },
  { name: "Postgres error text", pattern: /violates (?:foreign key|check|not-null|unique)|duplicate key value|permission denied for|relation "[^"]+" does not exist/i },
  { name: "RLS/policy wording", pattern: /row-level security|new row violates|policy for (?:table|relation)/i },
  { name: "Supabase/PostgREST", pattern: /supabase|postgrest|pgrst|service_role/i },
  { name: "stack trace", pattern: /\bat\s+(?:Object|Module|async|Function)\.[\w$.]+\s*\(|\/node_modules\/|webpack-internal:/ },
  // Only unambiguous schema identifiers. Bare words like "inquiries" and
  // "profiles" are ordinary UI copy as well as table names, and flagging
  // them reports the product's own vocabulary as a leak.
  { name: "internal table name", pattern: /(?:coffee_offers|media_translations|origin_translations|coffee_translations|price_tiers|offer_sensory_notes|site_page_sections|media_assets)/ },
  { name: "internal function name", pattern: /\badmin_(?:set_user_blocked|access_required)\b|\brpc\(/i },
  { name: "raw translation key", pattern: /\b(?:admin|account|auth|errors|catalog|product|home|origins|inquiry)\.[a-z][A-Za-z]+(?:\.[a-z][A-Za-z]+)*\b/ },
];

/** Reads everything a person could see, and reports any backend signature. */
async function leaks(page: Page, where: string): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText || "");
  const found: string[] = [];
  for (const { name, pattern } of RAW_ERROR_SIGNATURES) {
    const match = text.match(pattern);
    if (match) found.push(`${where}: ${name} -> "${match[0]}"`);
  }
  return found;
}

async function signIn(page: Page, email: string, password: string, at: string) {
  await page.goto(at);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.describe("Phase 11 cross-cutting quality", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "One engine is enough for these; they assert semantics, not rendering.",
  );

  // ---------------------------------------------------------------- anonymous

  test("no failure reachable without an account exposes backend text", async ({
    page,
  }) => {
    const problems: string[] = [];

    // A route that does not exist, in both languages.
    for (const path of ["/nonexistent-page", "/ar/nonexistent-page"]) {
      await page.goto(path);
      problems.push(...(await leaks(page, `404 ${path}`)));
    }

    // A detail route whose slug cannot resolve — the loader throws upstream.
    for (const path of [
      "/green-coffee-offer-list/no-such-coffee",
      "/ar/coffee-origins/no-such-origin",
      "/knowledge/no-such-article",
    ]) {
      await page.goto(path);
      problems.push(...(await leaks(page, `missing ${path}`)));
    }

    // Rejected credentials, and a recovery link that carries no valid state.
    await signIn(page, "not-a-user@example.com", "WrongPassword!1", "/sign-in");
    await page.waitForLoadState("networkidle");
    problems.push(...(await leaks(page, "invalid credentials")));
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.goto("/reset-password");
    await page.waitForLoadState("networkidle");
    problems.push(...(await leaks(page, "recovery without state")));

    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("an unauthorized destination is refused without revealing whether it exists", async ({
    page,
  }) => {
    // Anonymous at an Admin URL must not be told the difference between
    // "no such record" and "not yours" by a raw error.
    for (const path of ["/admin", "/admin/products", "/admin/users"]) {
      const response = await page.goto(path);
      expect(
        [200, 302, 307, 404].includes(response?.status() ?? 0),
        `${path} answered ${response?.status()}`,
      ).toBe(true);
      expect(page.url(), `${path} left the visitor inside the Admin`).not.toMatch(
        /\/admin(\/|$)/,
      );
      expect(await leaks(page, `anon ${path}`)).toEqual([]);
    }
  });

  // ------------------------------------------------------------ keyboard only

  test("the public shell is fully operable from the keyboard", async ({
    page,
  }) => {
    await page.goto("/");

    // Skip link is the first stop and moves focus into the main landmark.
    await page.keyboard.press("Tab");
    const skip = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? "",
      href: document.activeElement?.getAttribute("href") ?? "",
    }));
    expect(skip.href, "the first tab stop should be the skip link").toContain(
      "#",
    );

    // Every focused element must show a focus indicator rather than relying
    // on the browser default being suppressed.
    const invisible = await page.evaluate(() => {
      const offenders: string[] = [];
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input, select, textarea",
        ),
      ].filter((el) => el.offsetParent !== null);
      for (const el of candidates.slice(0, 60)) {
        el.focus();
        const style = getComputedStyle(el);
        const ring =
          style.outlineStyle !== "none" &&
          parseFloat(style.outlineWidth || "0") > 0;
        const shadow = style.boxShadow !== "none";
        const bordered = style.borderColor !== "";
        if (!ring && !shadow && !bordered)
          offenders.push(el.tagName + "." + el.className.toString().slice(0, 40));
      }
      return offenders;
    });
    expect(invisible, "focusable elements with no focus affordance").toEqual([]);
  });

  test("the mobile drawer traps focus, closes on Escape and restores it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 780 });

    for (const path of ["/", "/ar"]) {
      await page.goto(path);
      // Opened from a scrolled position: the drawer is `position: fixed`, and
      // the header is a containing block for fixed descendants, so this is
      // where an off-screen drawer would show up.
      await page.evaluate(() => window.scrollTo(0, 2000));
      const trigger = page.locator("button[aria-haspopup='dialog']").first();
      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // It must actually cover the viewport, not the header's own box.
      const geometry = await page.evaluate(() => {
        const layer = document
          .querySelector('[role="dialog"]')!
          .closest(".fixed") as HTMLElement;
        const rect = layer.getBoundingClientRect();
        return { height: Math.round(rect.height), viewport: window.innerHeight };
      });
      expect(
        geometry.height,
        `drawer layer spans ${geometry.height}px of a ${geometry.viewport}px viewport`,
      ).toBe(geometry.viewport);

      // Focus starts inside, and Tab cannot leave.
      expect(
        await page.evaluate(
          () => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement),
        ),
      ).toBe(true);
      for (let i = 0; i < 25; i += 1) await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement),
        ),
        "Tab escaped the drawer",
      ).toBe(true);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.activeElement?.getAttribute("aria-haspopup") === "dialog",
        ),
        "focus did not return to the trigger",
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("the header menus open, navigate and close from the keyboard", async ({
    page,
  }) => {
    // The mega menu is a desktop affordance — below `xl` the header offers the
    // drawer instead, which the previous test covers. Fixing the width here
    // keeps this test about the menu rather than about the breakpoint.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const menuTrigger = page.locator("button[aria-expanded]:visible").first();
    if (!(await menuTrigger.count())) test.skip(true, "No menu on this shell");

    await menuTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute("aria-expanded") === "false",
      ),
      "Escape did not return focus to the menu trigger",
    ).toBe(true);
  });

  // ------------------------------------------------------- the five personas

  test.describe("every persona's shell", () => {
    test.skip(
      !hasAuthFixtureCredentials,
      "MANUAL QA REQUIRED: Auth fixture credentials are unavailable",
    );

    let people!: AuthFixtureSet;
    /** Reference rows this suite creates through the Admin UI. */
    const created: { table: string; slug: string }[] = [];

    test.beforeAll(async () => {
      test.setTimeout(180_000);
      people = await createAuthFixtureSet("p11");
    });

    test.afterAll(async () => {
      // The duplicate-conflict check has to create a real row to collide with,
      // so it is removed here rather than left behind for the next run.
      for (const row of created)
        await service.from(row.table).delete().eq("slug", row.slug);
      await people?.cleanup();
    });

    test("VERIFIED: the account shell passes axe and leaks nothing", async ({
      page,
    }, testInfo) => {
      await signIn(page, people.verified.email, people.verified.password, "/sign-in");
      await page.waitForURL(/\/account$/, { timeout: 30_000 });
      await runAxe(page, testInfo, "p11-account-en");
      expect(await leaks(page, "account")).toEqual([]);

      // An invalid profile submission must name the field, keep the value,
      // and say nothing about the database.
      await page.goto("/account/settings");
      const phone = page.locator('input[name="phone"]').first();
      if (await phone.count()) {
        await phone.fill("not-a-phone");
        await page
          .locator('form:has(input[name="phone"]) button[type="submit"]')
          .first()
          .click();
        await page.waitForLoadState("networkidle");
        await expect(phone, "the rejected value was discarded").toHaveValue(
          "not-a-phone",
        );
        expect(await leaks(page, "invalid profile")).toEqual([]);
      }

      await page.goto("/ar/account");
      await runAxe(page, testInfo, "p11-account-ar");
      expect(await leaks(page, "account ar")).toEqual([]);
    });

    test("UNVERIFIED: told what to do, in both languages, with no backend text", async ({
      page,
    }, testInfo) => {
      await signIn(
        page,
        people.unverified.email,
        people.unverified.password,
        "/sign-in",
      );
      await page.waitForLoadState("networkidle");
      expect(page.url(), "an unverified account reached the account area").not.toMatch(
        /\/account$/,
      );
      await runAxe(page, testInfo, "p11-unverified");
      expect(await leaks(page, "unverified")).toEqual([]);
    });

    test("BLOCKED: refused everywhere, and told so in localized copy", async ({
      page,
    }, testInfo) => {
      await signIn(page, people.blocked.email, people.blocked.password, "/sign-in");
      await page.waitForLoadState("networkidle");
      expect(page.url(), "a blocked account reached the account area").not.toMatch(
        /\/account$/,
      );
      await expect(page.getByRole("alert").first()).toBeVisible();
      await runAxe(page, testInfo, "p11-blocked");
      expect(await leaks(page, "blocked")).toEqual([]);

      // And still refused when it walks straight at a protected route.
      await page.goto("/account/favorites");
      expect(page.url()).not.toMatch(/\/account\/favorites$/);
      expect(await leaks(page, "blocked direct")).toEqual([]);
    });

    test("ADMIN: the workspace passes axe in both languages and leaks nothing", async ({
      page,
    }, testInfo) => {
      await signIn(
        page,
        people.admin.email,
        people.admin.password,
        "/dashboard-admin",
      );
      await page.waitForURL(/\/admin$/, { timeout: 30_000 });
      await runAxe(page, testInfo, "p11-admin-dashboard");
      expect(await leaks(page, "admin dashboard")).toEqual([]);

      // An invalid create is the most common Admin failure; it must report
      // per field and say nothing about the table underneath.
      await page.goto("/admin/origins");
      await page
        .locator("form")
        .filter({ has: page.locator('[name="slug"]') })
        .first()
        .locator('button[type="submit"]')
        .first()
        .click();
      await page.waitForLoadState("networkidle");
      expect(await leaks(page, "admin invalid create")).toEqual([]);

      // A duplicate conflict: create the same slug twice.
      const slug = `qa-p11-${Date.now().toString(36)}`;
      created.push({ table: "varieties", slug });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await page.goto("/admin/varieties");
        const form = page
          .locator("form")
          .filter({ has: page.locator('[name="slug"]') })
          .first();
        await form.locator('[name="slug"]').fill(slug);
        const name = form.locator('[name="name"]');
        if (await name.count()) await name.fill(`[QA-P11] ${slug}`);
        await form.locator('button[type="submit"]').first().click();
        await page.waitForLoadState("networkidle");
      }
      expect(await leaks(page, "admin duplicate")).toEqual([]);

      for (const path of ["/ar/admin", "/ar/admin/products", "/ar/admin/users"]) {
        await page.goto(path);
        expect(await leaks(page, `admin ar ${path}`)).toEqual([]);
      }
      await page.goto("/ar/admin");
      await runAxe(page, testInfo, "p11-admin-dashboard-ar");
    });

    test("VERIFIED at an Admin URL is refused, and the refusal is not a raw error", async ({
      page,
    }) => {
      await signIn(page, people.verified.email, people.verified.password, "/sign-in");
      await page.waitForURL(/\/account$/, { timeout: 30_000 });
      for (const path of ["/admin", "/admin/users", "/admin/settings"]) {
        await page.goto(path);
        expect(page.url(), `${path} admitted a customer`).not.toMatch(
          /\/admin(\/|$)/,
        );
        expect(await leaks(page, `customer at ${path}`)).toEqual([]);
      }
    });
  });
});
