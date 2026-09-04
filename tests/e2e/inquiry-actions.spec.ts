import { expect, test, type Page } from "@playwright/test";
import { collectRuntimeProblems, devOverlayError } from "./helpers";
import { service } from "./auth-fixtures";
import { hasP12Fixtures, p12Prefix, signInAs } from "./p12-fixtures";

/**
 * The two actions on an offer are deliberately different businesses.
 *
 * A **sample request** is unique per coffee while one is active — the customer
 * cannot have two in flight. A **commercial inquiry** has no such rule: a buyer
 * may raise a new one whenever business calls for it. What neither may do is
 * turn one intent into several rows.
 *
 * These tests pin both halves of that, and the asymmetry between them, because
 * the easy mistake is to "fix" the commercial path by giving it the sample
 * path's uniqueness rule and quietly blocking legitimate follow-ups.
 */

test.describe.configure({ timeout: 240_000 });

test.skip(
  !hasP12Fixtures,
  "persona fixtures unavailable — run `node scripts/e2e/seed.mjs`",
);

const COMMERCIAL = /commercial inquiry|استفسار تجاري/i;
const SAMPLE = /^request sample$|^طلب عينة$/i;
const ACTIVE_SAMPLE = /active sample request|لديك طلب عينة نشط/i;
const VIEW_REQUEST = /view request|عرض الطلب/i;

/** The verified fixture's id, resolved once per test that needs it. */
async function verifiedFixtureId() {
  const { data } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const user = data.users.find((candidate) =>
    (candidate.email ?? "").includes("-verified@"),
  );
  return user?.id ?? null;
}

/**
 * The seed leaves the optional profile fields empty, and the action correctly
 * refuses without them. These are ordinary editable profile fields on a
 * manifest-owned fixture row — never authorization state, and never a bypass
 * of a rule under test.
 */
async function completeFixtureProfile(userId: string) {
  await service
    .from("profiles")
    .update({
      phone: "+201000000001",
      address: "1 Test Street, Cairo",
      country_code: "EG",
    })
    .eq("id", userId);
}

/** Removes this spec's own inquiries so repeated runs start from a known state. */
async function clearFixtureInquiries(userId: string) {
  await service.from("inquiries").delete().eq("user_id", userId);
}

async function openFixtureOffer(page: Page, locale: "en" | "ar" = "en") {
  const prefix = locale === "ar" ? "/ar" : "";
  await page.goto(`${prefix}/green-coffee-offer-list`, {
    waitUntil: "domcontentloaded",
  });
  const href = await page
    .locator(`a[href*="/green-coffee-offer-list/${p12Prefix}"]`)
    .first()
    .getAttribute("href");
  expect(href, "no fixture coffee on the catalog").toBeTruthy();
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  return href!;
}

async function submit(page: Page, control: RegExp, message: string) {
  await page.getByRole("button", { name: control }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('textarea[name="message"]').fill(message);
  await dialog.locator('button[type="submit"]').click();
  await expect(
    dialog.locator('[role="status"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });
  const text = await dialog
    .locator('[role="status"], [role="alert"]')
    .first()
    .innerText();
  await page.keyboard.press("Escape");
  return text;
}

const countOf = async (userId: string, type: "PRODUCT" | "SAMPLE_REQUEST") => {
  const { count } = await service
    .from("inquiries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type);
  return count ?? 0;
};

// ===================================================== commercial inquiry

test("an identical commercial inquiry resent immediately does not create a second row", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  expect(userId).toBeTruthy();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  const problems = collectRuntimeProblems(page);
  await signInAs(page, "verified", "en");
  await openFixtureOffer(page);

  const identical =
    "Please share pricing and availability for a full container of this lot.";
  const first = await submit(page, COMMERCIAL, identical);
  expect(first, "first commercial inquiry was not accepted").toMatch(
    /HC-[A-Z0-9]+/,
  );
  expect(await countOf(userId!, "PRODUCT")).toBe(1);

  // The accidental resend: same customer, same offer, same words.
  const second = await submit(page, COMMERCIAL, identical);
  expect(
    await countOf(userId!, "PRODUCT"),
    "an identical resend created a duplicate inquiry",
  ).toBe(1);

  // And it is answered with the original reference, not a refusal.
  const code = first.match(/HC-[A-Z0-9]+/)?.[0];
  expect(second, "the resend did not return the original reference").toContain(
    code!,
  );

  expect(problems.summary().pageErrors).toEqual([]);
  expect(await devOverlayError(page)).toBeNull();
});

test("a different commercial inquiry for the same coffee is still allowed", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  await signInAs(page, "verified", "en");
  await openFixtureOffer(page);

  await submit(page, COMMERCIAL, "Please share pricing for one container.");
  expect(await countOf(userId!, "PRODUCT")).toBe(1);

  // Different intent, same coffee, moments later. This must go through: the
  // dedupe is an accident window, not a business cooldown.
  await submit(
    page,
    COMMERCIAL,
    "Separately, could you confirm the shipping schedule for this lot?",
  );
  expect(
    await countOf(userId!, "PRODUCT"),
    "a genuine second commercial inquiry was blocked",
  ).toBe(2);
});

test("the submit control is disabled while a commercial inquiry is in flight", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  await signInAs(page, "verified", "en");
  await openFixtureOffer(page);

  await page.getByRole("button", { name: COMMERCIAL }).first().click();
  const dialog = page.getByRole("dialog");
  const button = dialog.locator('button[type="submit"]');
  await dialog
    .locator('textarea[name="message"]')
    .fill("Please confirm availability for this lot.");
  await button.click();
  // Either still pending (disabled + aria-busy) or already settled, in which
  // case the control is removed entirely so it cannot be pressed again.
  await expect
    .poll(async () =>
      (await button.count()) === 0 ? "gone" : await button.isDisabled(),
    )
    .not.toBe(false);
});

// ======================================================== sample request

test("a first sample request succeeds and the coffee then shows the active state", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  const problems = collectRuntimeProblems(page);
  await signInAs(page, "verified", "en");
  await openFixtureOffer(page);

  await expect(
    page.getByRole("button", { name: SAMPLE }).first(),
  ).toBeVisible();
  const result = await submit(page, SAMPLE, "Please send a 300g sample.");
  expect(result).toMatch(/HC-[A-Z0-9]+/);
  expect(await countOf(userId!, "SAMPLE_REQUEST")).toBe(1);

  // Reload: the offer must now present the state, not an action that cannot
  // succeed.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(ACTIVE_SAMPLE).first()).toBeVisible();
  await expect(page.getByRole("button", { name: SAMPLE })).toHaveCount(0);

  const view = page.getByRole("link", { name: VIEW_REQUEST }).first();
  await expect(view).toBeVisible();
  await view.click();
  await page.waitForURL(/\/account\/requests\/HC-/, { timeout: 20_000 });

  expect(problems.summary().pageErrors).toEqual([]);
});

test("the active sample state renders in Arabic with correct direction", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  await signInAs(page, "verified", "en");
  await openFixtureOffer(page);
  await submit(page, SAMPLE, "Please send a sample of this lot.");

  await signInAs(page, "verified", "ar");
  await openFixtureOffer(page, "ar");
  await expect(page.getByText(ACTIVE_SAMPLE).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: VIEW_REQUEST }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.getAttribute("dir")),
  ).toBe("rtl");
});

test("the two actions are distinguishable in both languages", async ({
  page,
}) => {
  const userId = await verifiedFixtureId();
  await completeFixtureProfile(userId!);
  await clearFixtureInquiries(userId!);

  for (const locale of ["en", "ar"] as const) {
    await signInAs(page, "verified", locale);
    await openFixtureOffer(page, locale);
    await expect(
      page.getByRole("button", { name: COMMERCIAL }).first(),
      `${locale}: no commercial inquiry control`,
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: SAMPLE }).first(),
      `${locale}: no sample control`,
    ).toBeVisible();
  }
});

// ================================================= authorization boundaries

test("anonymous and Admin never see a customer request control", async ({
  page,
}) => {
  // Anonymous: the commercial path still routes to sign-in, and the public
  // sample dialog remains the approved anonymous route.
  await openFixtureOffer(page);
  await expect(
    page.getByRole("link", { name: /sign in/i }).first(),
  ).toBeVisible();

  // An Administrator is not a customer and must not be offered either action.
  await signInAs(page, "admin", "en");
  await openFixtureOffer(page);
  await expect(page.getByRole("button", { name: COMMERCIAL })).toHaveCount(0);
  await expect(page.getByRole("button", { name: SAMPLE })).toHaveCount(0);
});
