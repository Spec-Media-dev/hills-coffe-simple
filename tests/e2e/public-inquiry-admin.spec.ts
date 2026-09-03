import { expect, test, type Page } from "@playwright/test";
import {
  createAuthFixtureSet,
  hasAuthFixtureCredentials,
  service,
  type AuthFixtureSet,
} from "./auth-fixtures";

/**
 * OA-T06/OA-T09/OA-T10 — an anonymous submission has to reach the people who
 * answer it.
 *
 * A row in the database is only half the proof. FR-080 says an anonymous
 * `GENERAL` or `SAMPLE_REQUEST` must appear in the Lead Inbox that already
 * exists, through the same fields, filters and status controls, with no new
 * Admin surface built for it. This suite submits as a real anonymous visitor
 * in the browser, then signs in as a real Administrator and looks for the
 * exact request code that visitor was shown.
 */

const REQUEST_CODE = /HC-[A-Z0-9]{10}/;

const uniqueEmail = (tag: string) =>
  `qa-oa-admin-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.invalid`;

/** Submits the public RFQ and returns the code the server actually minted. */
async function submitRfq(page: Page, email: string): Promise<string> {
  await page.goto("/request-a-quote");
  await page.fill('input[name="fullName"]', "[QA-OA-ADMIN] Buyer");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', "+201000000123");
  await page.fill(
    'textarea[name="message"]',
    "Admin visibility proof: sourcing washed lots for Q3.",
  );
  await page.locator('form button[type="submit"]').click();

  const status = page.locator("main").getByRole("status");
  await expect(status).toBeVisible({ timeout: 30_000 });
  const text = (await status.textContent()) ?? "";
  const code = text.match(REQUEST_CODE)?.[0];
  expect(code, "no request code was shown to the visitor").toBeTruthy();
  return code!;
}

/** Submits the public sample request from a real coffee page. */
async function submitSample(page: Page, email: string): Promise<string> {
  await page.goto("/green-coffee-offer-list");
  await page.locator('a[href*="/green-coffee-offer-list/"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /request sample/i }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="fullName"]').fill("[QA-OA-ADMIN] Buyer");
  await dialog.locator('input[name="email"]').fill(email);
  await dialog.locator('input[name="phone"]').fill("+201000000123");
  await dialog.locator('input[name="address"]').fill("1 Test Street, Dubai");
  await dialog.locator('input[name="countryCode"]').fill("AE");
  await dialog
    .locator('textarea[name="message"]')
    .fill("Admin visibility proof for this lot.");
  await dialog.locator('button[type="submit"]').click();

  const status = dialog.getByRole("status");
  await expect(status).toBeVisible({ timeout: 30_000 });
  const text = (await status.textContent()) ?? "";
  const code = text.match(REQUEST_CODE)?.[0];
  expect(code, "no request code was shown to the visitor").toBeTruthy();
  return code!;
}

test.describe("anonymous submissions reach the Admin Lead Inbox", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: Auth fixture credentials are unavailable",
  );

  let people!: AuthFixtureSet;
  const created: string[] = [];

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createAuthFixtureSet("oa-admin");
  });

  test.afterAll(async () => {
    for (const email of created)
      await service.from("inquiries").delete().eq("email", email);
    await people?.cleanup();
  });

  async function signInAdmin(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(people.admin.email);
    await page.locator('input[name="password"]').fill(people.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  test("a GENERAL RFQ submitted anonymously is visible to an Administrator", async ({
    page,
  }) => {
    const email = uniqueEmail("rfq");
    created.push(email);
    const code = await submitRfq(page, email);

    // The row really exists, with the shape FR-069/FR-072 require.
    const { data: row } = await service
      .from("inquiries")
      .select("type,status,user_id,request_code,email")
      .eq("request_code", code)
      .single();
    expect(row?.type).toBe("GENERAL");
    expect(row?.status).toBe("NEW");
    expect(row?.user_id).toBeNull();
    expect(row?.email).toBe(email);

    // And a real Administrator can find it in the existing Lead Inbox,
    // searching by the submitter's email exactly as they would for any lead.
    await signInAdmin(page);
    await page.goto(`/admin/inquiries?query=${encodeURIComponent(email)}`);
    await expect(page.locator("main")).toContainText(code, { timeout: 30_000 });
    await expect(page.locator("main")).toContainText("[QA-OA-ADMIN] Buyer");
  });

  test("an anonymous SAMPLE_REQUEST is visible and keeps its coffee context", async ({
    page,
  }) => {
    const email = uniqueEmail("sample");
    created.push(email);
    const code = await submitSample(page, email);

    const { data: row } = await service
      .from("inquiries")
      .select("type,status,user_id,coffee_id,coffee_name_snapshot,request_code")
      .eq("request_code", code)
      .single();
    expect(row?.type).toBe("SAMPLE_REQUEST");
    expect(row?.status).toBe("NEW");
    expect(row?.user_id).toBeNull();
    // Derived server-side from the trusted offer, never sent by the browser.
    expect(row?.coffee_id).toBeTruthy();
    expect(row?.coffee_name_snapshot).toBeTruthy();

    await signInAdmin(page);
    await page.goto(`/admin/inquiries?query=${encodeURIComponent(email)}`);
    await expect(page.locator("main")).toContainText(code, { timeout: 30_000 });
  });

  test("the Administrator can advance an anonymous lead through the existing workflow", async ({
    page,
  }) => {
    const email = uniqueEmail("workflow");
    created.push(email);
    const code = await submitRfq(page, email);

    await signInAdmin(page);
    await page.goto(`/admin/inquiries?query=${encodeURIComponent(email)}`);
    await expect(page.locator("main")).toContainText(code, { timeout: 30_000 });

    // Open the lead and take whichever next step its current status allows —
    // the same control set an account-backed lead offers. No anonymous-only
    // Admin affordance exists, and none should.
    await page.getByRole("link", { name: new RegExp(code) }).first().click();
    await page.waitForLoadState("networkidle");

    // Target the control by its attribute, not its label: the labels are
    // localized, and the point is that the *existing* status control serves
    // this lead unchanged.
    const advance = page.locator('main button[name="status"]').first();
    await expect(advance).toBeVisible({ timeout: 15_000 });
    const chosen = await advance.getAttribute("value");
    expect(chosen, "the Lead Inbox offered no next status").toBeTruthy();
    await advance.click();

    // If the transition were refused, the Lead Inbox says so in its own alert
    // — surface that rather than only reporting a stale status later.
    const refusal = page.locator("main").getByRole("alert");
    if (await refusal.count())
      expect(
        await refusal.first().textContent(),
        "the Lead Inbox refused the transition",
      ).toBeNull();

    // The transition really happened, arbitrated by the existing trigger.
    // Polled because the server action revalidates asynchronously.
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("inquiries")
            .select("status")
            .eq("request_code", code)
            .single();
          return data?.status;
        },
        { timeout: 20_000, message: `status never moved to ${chosen}` },
      )
      .toBe(chosen);
  });
});
