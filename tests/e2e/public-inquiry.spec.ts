import { expect, test, type Page } from "@playwright/test";
import { collectPageProblems, expectNoPriceLeak, runAxe } from "./helpers";
import { visitInTheme } from "./ui-audit";

/**
 * OA-T10 — the anonymous public journeys, in a real browser.
 *
 * Two things this suite refuses to accept as evidence: a form that renders,
 * and a success message that appears without the database having confirmed
 * anything. Every success assertion here checks for the request code the
 * server generated, which only exists if a row was actually written.
 *
 * The submission tests require migration PP12-T02 to be applied. Before that
 * they fail rather than skip — a quiet skip reads exactly like a pass in a
 * summary line, and this addendum's whole point is that the flow genuinely
 * works.
 */

/** A request code looks like `HC-XXXXXXXXXX` and only the server can mint one. */
const REQUEST_CODE = /HC-[A-Z0-9]{10}/;

const uniqueEmail = (tag: string) =>
  `qa-oa-e2e-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.invalid`;

async function fillRfq(page: Page, email: string) {
  await page.fill('input[name="fullName"]', "[QA-OA-E2E] Buyer");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', "+201000000123");
  await page.fill(
    'textarea[name="message"]',
    "Browser acceptance: washed Ethiopian, two containers, Dubai.",
  );
}

async function openSampleDialog(page: Page, path = "/green-coffee-offer-list") {
  await page.goto(path);
  await page.locator('a[href*="/green-coffee-offer-list/"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /request sample|اطلب عينة/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillSample(page: Page, email: string) {
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="fullName"]').fill("[QA-OA-E2E] Buyer");
  await dialog.locator('input[name="email"]').fill(email);
  await dialog.locator('input[name="phone"]').fill("+201000000123");
  await dialog.locator('input[name="address"]').fill("1 Test Street, Dubai");
  await dialog.locator('input[name="countryCode"]').fill("AE");
  await dialog
    .locator('textarea[name="message"]')
    .fill("Browser acceptance sample request for this lot.");
}

test.describe("anonymous public RFQ", () => {
  test("submits without an account and shows the server's request code", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await page.goto("/request-a-quote");
    await fillRfq(page, uniqueEmail("rfq-en"));
    await page.locator('form button[type="submit"]').click();

    const status = page.locator("main").getByRole("status");
    await expect(status).toBeVisible({ timeout: 30_000 });
    await expect(status).toContainText(REQUEST_CODE);

    // No session was created by submitting.
    const cookies = await page.context().cookies();
    expect(
      cookies.some((cookie) => /sb-.*-auth-token/.test(cookie.name)),
      "submitting an RFQ created an auth session",
    ).toBe(false);

    expect(problems.appErrors()).toEqual([]);
  });

  test("submits in Arabic and keeps the request code left-to-right", async ({
    page,
  }) => {
    await page.goto("/ar/request-a-quote");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await fillRfq(page, uniqueEmail("rfq-ar"));
    await page.locator('form button[type="submit"]').click();

    const status = page.locator("main").getByRole("status");
    await expect(status).toBeVisible({ timeout: 30_000 });
    await expect(status).toContainText(REQUEST_CODE);
    // A request code is an identifier, not prose: it must not be mirrored.
    await expect(status.locator('[dir="ltr"]').first()).toBeVisible();
  });

  test("reports each invalid field inline, with no native browser popup", async ({
    page,
  }) => {
    await page.goto("/request-a-quote");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    expect(await page.locator('[aria-invalid="true"]').count()).toBeGreaterThan(1);
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    // `noValidate` is what keeps the browser's own popup out of the way.
    await expect(page.locator("form").first()).toHaveAttribute("novalidate", "");
  });

  test("keeps what was typed when the server rejects the submission", async ({
    page,
  }) => {
    await page.goto("/request-a-quote");
    await page.fill('input[name="fullName"]', "[QA-OA-E2E] Preserved");
    await page.fill('input[name="email"]', "not-an-email");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toHaveValue(
      "[QA-OA-E2E] Preserved",
    );
  });

  test("silently refuses a submission that filled the honeypot", async ({
    page,
  }) => {
    await page.goto("/request-a-quote");
    await fillRfq(page, uniqueEmail("honeypot"));
    await page.evaluate(() => {
      const field = document.querySelector(
        'input[name="website"]',
      ) as HTMLInputElement;
      field.value = "bot";
    });
    await page.locator('form button[type="submit"]').click();
    // Rejected, and indistinguishable from ordinary validation.
    await expect(page.locator("form").getByRole("alert")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("form").getByRole("status")).toHaveCount(0);
  });
});

test.describe("anonymous public sample request", () => {
  test("submits from a coffee page and shows the server's request code", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await openSampleDialog(page);
    await fillSample(page, uniqueEmail("sample-en"));
    await page.getByRole("dialog").locator('button[type="submit"]').click();

    const status = page.getByRole("dialog").getByRole("status");
    await expect(status).toBeVisible({ timeout: 30_000 });
    await expect(status).toContainText(REQUEST_CODE);
    expect(problems.appErrors()).toEqual([]);
  });

  test("blocks a second active request for the same email and coffee, without disclosing a code", async ({
    page,
  }) => {
    const email = uniqueEmail("dupe");
    await openSampleDialog(page);
    await fillSample(page, email);
    await page.getByRole("dialog").locator('button[type="submit"]').click();
    await expect(
      page.getByRole("dialog").getByRole("status"),
    ).toContainText(REQUEST_CODE, { timeout: 30_000 });

    // Same person, same coffee, straight away.
    await openSampleDialog(page);
    await fillSample(page, email);
    await page.getByRole("dialog").locator('button[type="submit"]').click();

    const alert = page.getByRole("dialog").getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 30_000 });
    // Refused, and told why in plain language.
    await expect(alert).toContainText(/already have an active sample request/i);
    // Deliberately WITHOUT the existing request's code. An anonymous caller
    // types any email they like, so echoing the reference back would answer
    // "does this person have an active request for this coffee, and what is
    // it?" for a stranger. See contracts/public-inquiry-actions.md.
    await expect(alert).not.toContainText(REQUEST_CODE);
    // And no raw constraint name escaped either.
    await expect(alert).not.toContainText(/uq_inquiries|constraint|23505/i);
  });

  test("requires the delivery details a sample actually needs", async ({
    page,
  }) => {
    await openSampleDialog(page);
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[name="fullName"]').fill("[QA-OA-E2E] Buyer");
    await dialog.locator('input[name="email"]').fill(uniqueEmail("no-addr"));
    await dialog.locator('input[name="phone"]').fill("+201000000123");
    await dialog
      .locator('textarea[name="message"]')
      .fill("No address supplied on purpose.");
    await dialog.locator('button[type="submit"]').click();
    await expect(
      dialog.locator('input[name="address"][aria-invalid="true"]'),
    ).toBeVisible();
  });

  test("still sends an anonymous visitor to sign-in for a PRODUCT inquiry", async ({
    page,
  }) => {
    await page.goto("/green-coffee-offer-list");
    await page.locator('a[href*="/green-coffee-offer-list/"]').first().click();
    await page.waitForLoadState("networkidle");
    // Scope to the inquiry panel by anchoring on its sample control: the two
    // sit in the same row. A page-wide `a[href*="/sign-in"]` would match the
    // header's own sign-in links instead — which is not what FR-079 is about,
    // and which silently passes on desktop while matching a *hidden* nav link
    // on mobile.
    const controls = page
      .getByRole("button", { name: /request sample/i })
      .first()
      .locator("xpath=..");
    const signIn = controls.locator('a[href*="/sign-in"]');
    await expect(signIn, "the PRODUCT control must still be a sign-in link").toBeVisible();
    // Still a link, never a form: the authenticated-only path is unchanged.
    await expect(signIn).toHaveCount(1);
  });
});

test.describe("public inquiry surfaces: presentation and safety", () => {
  for (const [label, path] of [
    ["en", "/request-a-quote"],
    ["ar", "/ar/request-a-quote"],
  ] as const)
    for (const theme of ["light", "dark"] as const)
      test(`${label} ${theme}: renders cleanly with no price leak`, async ({
        page,
      }) => {
        const problems = collectPageProblems(page);
        await visitInTheme(page, path, theme);
        await expect(page.locator('input[name="fullName"]')).toBeVisible();
        await expectNoPriceLeak(page);
        expect(problems.appErrors()).toEqual([]);
      });

  test("is usable at 360px and 375px", async ({ page }) => {
    for (const width of [360, 375]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/request-a-quote");
      await expect(page.locator('input[name="fullName"]')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    }
  });

  test("passes axe on the RFQ page in both languages", async ({
    page,
  }, testInfo) => {
    await page.goto("/request-a-quote");
    await runAxe(page, testInfo, "oa-rfq-en");
    await page.goto("/ar/request-a-quote");
    await runAxe(page, testInfo, "oa-rfq-ar");
  });

  test("is completable from the keyboard alone", async ({ page }) => {
    await page.goto("/request-a-quote");
    await page.locator('input[name="fullName"]').focus();
    await page.keyboard.type("[QA-OA-E2E] Keyboard");
    await page.keyboard.press("Tab");
    await page.keyboard.type(uniqueEmail("keyboard"));
    const focused = await page.evaluate(
      () => (document.activeElement as HTMLInputElement)?.name,
    );
    expect(focused, "Tab did not reach the email field").toBe("email");
  });

  test("keeps the sample dialog operable from the keyboard", async ({
    page,
  }) => {
    await openSampleDialog(page);
    // Focus enters the dialog, and Escape closes it and restores the trigger.
    expect(
      await page.evaluate(
        () =>
          !!document
            .querySelector('[role="dialog"]')
            ?.contains(document.activeElement),
      ),
      "focus did not enter the dialog",
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("shows the whole form with motion disabled", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/request-a-quote");
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
    await context.close();
  });
});

/**
 * OA-T04 — the per-IP half of the anti-abuse story, in a real browser.
 *
 * The per-email half and its concurrency proof live in
 * `tests/integration/public-inquiry.test.ts`; this one exercises the layer
 * that lives in the Next server process. Two details make it honest:
 *
 *  - It sends its own `x-forwarded-for`, so it fills a bucket of its own
 *    instead of the shared one every other test shares on localhost. That
 *    also proves the header is what the limiter actually keys on.
 *  - It submits a well-formed but nonexistent offer id. Zod passes it, so
 *    the attempt reaches the limiter and is counted — but the database then
 *    refuses the offer, so the run writes no rows at all. The refusals
 *    before the ceiling therefore read "offer unavailable", and the one
 *    after it reads "too many requests": the change of answer is the proof
 *    that the limiter, not the database, spoke.
 */
test.describe("anonymous submissions are throttled per address", () => {
  test("refuses further attempts once one address exhausts its allowance", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    // A fresh address per run. A fixed one is not isolated: the limiter's
    // window is ten minutes and the same server process is reused across
    // projects, so the desktop run's bucket was still full when the mobile
    // run reached this test — which showed up honestly as "throttled at
    // attempt 1" rather than as a false pass.
    const address = `198.51.100.${Math.floor(Math.random() * 200) + 1}.${Date.now().toString(36)}`;
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": address },
    });
    const page = await context.newPage();

    await page.goto("/green-coffee-offer-list");
    await page.locator('a[href*="/green-coffee-offer-list/"]').first().click();
    await page.getByRole("button", { name: /request sample/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Well-formed, and deliberately not a real offer.
    await dialog
      .locator('input[name="offerId"]')
      .evaluate(
        (el: HTMLInputElement) =>
          (el.value = "00000000-0000-4000-8000-000000000000"),
      );
    await dialog.locator('input[name="fullName"]').fill("[QA-OA-IP] Buyer");
    await dialog
      .locator('input[name="email"]')
      .fill("qa-oa-ip@example.invalid");
    await dialog.locator('input[name="phone"]').fill("+201000000123");
    await dialog.locator('input[name="address"]').fill("1 Test Street, Dubai");
    await dialog.locator('input[name="countryCode"]').fill("AE");
    await dialog
      .locator('textarea[name="message"]')
      .fill("Per-IP throttle proof, no row is created by this attempt.");

    const submit = dialog.locator('button[type="submit"]');
    const alert = dialog.getByRole("alert");

    let throttledAt = 0;
    for (let attempt = 1; attempt <= 40 && !throttledAt; attempt += 1) {
      await submit.click();
      await expect(alert).toBeVisible({ timeout: 30_000 });
      const text = (await alert.textContent()) ?? "";
      if (/too many requests/i.test(text)) throttledAt = attempt;
      else expect(text, `attempt ${attempt}`).toMatch(/no longer available/i);
    }

    // It really did throttle, and only after letting a plausible number of
    // requests through — a limiter that refuses the first caller would pass
    // a naive "was it refused?" check while breaking the form for everyone.
    expect(throttledAt, "the address was never throttled").toBeGreaterThan(1);
    expect(throttledAt).toBeLessThanOrEqual(40);

    // And it stays refused for that address.
    await submit.click();
    await expect(alert).toContainText(/too many requests/i);

    await context.close();
  });
});

/**
 * OA-T09 — protected pricing, checked against the real numbers.
 *
 * `expectNoPriceLeak` matches a *shape* (`$12.50/kg`) in rendered text and in
 * JSON-LD. That is a good guard against a formatted price appearing on screen,
 * but it cannot catch the leak that actually matters here: a server component
 * that fetches the protected price, decides not to render it, and still ships
 * it to the browser inside the RSC payload or a prop blob. Nothing is
 * *displayed*, so a text scan passes while the number sits in view-source.
 *
 * So this test asks the database for the real `price_per_kg_usd` of a live,
 * publicly visible offer and then asserts that exact value appears nowhere an
 * anonymous visitor can reach it: not in the raw HTML (which contains every
 * meta tag, every inline script and the whole flight payload), and not in the
 * body of any response the page fetched.
 */
test.describe("protected pricing never reaches an anonymous visitor", () => {
  test("a real offer's price is absent from source, metadata and every response", async ({
    page,
  }) => {
    const { service } = await import("./auth-fixtures");
    // The protected number lives in `offer_price_tiers`, not on the offer
    // row: pricing is tiered by bag count, and every tier is protected.
    const { data: tiers, error } = await service
      .from("offer_price_tiers")
      .select("price_per_kg_usd")
      .limit(50);
    expect(error?.message ?? null, "could not read the price tiers").toBeNull();

    const priced = (tiers ?? []).filter(
      (tier) => Number(tier.price_per_kg_usd) > 0,
    );
    expect(
      priced.length,
      "no priced tier exists to test against — this check would be vacuous",
    ).toBeGreaterThan(0);

    // Every distinct way the number could be serialised.
    const needles = new Set<string>();
    for (const tier of priced) {
      const value = Number(tier.price_per_kg_usd);
      needles.add(String(value));
      needles.add(value.toFixed(2));
      if (Number.isInteger(value)) needles.add(`${value}.0`);
    }

    const bodies: Array<{ url: string; text: string }> = [];
    page.on("response", async (response) => {
      const type = response.headers()["content-type"] ?? "";
      if (!/text|json|javascript/i.test(type)) return;
      try {
        bodies.push({ url: response.url(), text: await response.text() });
      } catch {
        // A redirect or an aborted body has nothing to inspect.
      }
    });

    for (const path of [
      "/",
      "/green-coffee-offer-list",
      "/ar/green-coffee-offer-list",
      "/request-a-quote",
    ]) {
      bodies.length = 0;
      await page.goto(path, { waitUntil: "networkidle" });

      // Raw source: meta tags, inline scripts and the RSC flight payload.
      const source = await page.content();
      for (const needle of needles)
        expect(
          leakContext(source, needle),
          `${path}: protected price ${needle} must not appear in the page source`,
        ).toBeNull();

      for (const { url, text } of bodies)
        for (const needle of needles)
          expect(
            leakContext(text, needle),
            `${path}: protected price ${needle} must not appear in the response from ${url}`,
          ).toBeNull();
    }

    // The catalog really did render — otherwise the scan above proves nothing.
    await page.goto("/green-coffee-offer-list");
    expect(
      await page.locator('a[href*="/green-coffee-offer-list/"]').count(),
      "the catalog rendered no offers, so this scan would be vacuous",
    ).toBeGreaterThan(0);
  });
});

/**
 * Returns a short excerpt around a match, or null when the value is absent.
 *
 * Matching is bounded by non-digits so `12.5` does not "leak" every time the
 * string 112.55 appears in a hash, a timestamp or a CSS length — a false
 * positive here would be as damaging to trust in this suite as a false pass.
 */
function leakContext(haystack: string, needle: string): string | null {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const match = new RegExp(String.raw`(?<![\d.])${escaped}(?![\d])`).exec(
    haystack,
  );
  return match
    ? haystack.slice(Math.max(0, match.index - 60), match.index + 60)
    : null;
}
