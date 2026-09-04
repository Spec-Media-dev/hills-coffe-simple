import { expect, test, type Page } from "@playwright/test";
import {
  createInquiryPersonas,
  hasAuthFixtureCredentials,
  service,
  type InquiryPersonas,
  type Persona,
} from "./inquiry-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 7 — the inquiry and sample-delivery workflow, driven through the real
 * UI as the real personas.
 *
 * The database-level guarantees (unique index, transition trigger, immutable
 * history) are proven in `tests/integration/inquiry-lifecycle.test.ts`. This
 * suite proves the part only a browser can: that a verified customer can
 * actually complete the flow, that the Administrator sees the request with its
 * context and only the actions its lifecycle allows, and that what the
 * database refuses reaches the screen as localized domain copy rather than as
 * Postgres wording.
 */
test.describe("Phase 7 inquiry and sample workflow", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real request writes run once on desktop; Admin responsive work is Phase 10.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let people!: InquiryPersonas;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createInquiryPersonas();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await people?.cleanup();
  });

  async function signInCustomer(page: Page, persona: Persona) {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(persona.email);
    await page.locator('input[name="password"]').fill(persona.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/account$/, { timeout: 30_000 });
  }

  async function signInAdmin(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(people.admin.email);
    await page.locator('input[name="password"]').fill(people.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  /** Opens the sample dialog on the first offer of the shared QA coffee. */
  async function openSampleDialog(page: Page) {
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    const dialogTrigger = page
      .getByRole("button", { name: "Request sample" })
      .first();
    await dialogTrigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  const codeOf = (text: string) => {
    const match = text.match(/[A-Z0-9][A-Z0-9-]{4,}/);
    if (!match) throw new Error(`no request code in: ${text}`);
    return match[0];
  };

  // -------------------------------------------------------- FLOW A + FLOW B --

  test("FLOW A/B: a verified customer submits a sample request, sees it in Account, and is refused a duplicate through a different offer", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInCustomer(page, people.customer);

    // Loaded now, while no active request exists, so its controls are still
    // the pre-request ones when FLOW B uses it below.
    const staleTab = await page.context().newPage();
    await staleTab.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    await expect(
      staleTab.getByRole("button", { name: "Request sample" }),
    ).toHaveCount(2);

    const dialog = await openSampleDialog(page);
    await dialog
      .getByRole("textbox")
      .fill("Phase 7 acceptance run: please send a 300g review sample.");
    await dialog.getByRole("button", { name: "Submit sample request" }).click();

    const success = dialog.getByRole("status");
    await expect(success).toBeVisible({ timeout: 30_000 });
    const requestCode = codeOf(await success.innerText());

    // The submit control is gone once it has succeeded, so a second click
    // cannot produce a second request.
    await expect(
      dialog.getByRole("button", { name: "Submit sample request" }),
    ).toHaveCount(0);

    // The customer can reach the request from the confirmation itself.
    await dialog.getByRole("link", { name: "View request" }).click();
    await page.waitForURL(new RegExp(`/account/requests/${requestCode}$`));
    await expect(page.getByText(requestCode).first()).toBeVisible();
    // The timeline starts at the status the INSERT trigger recorded.
    await expect(
      page.getByText("Submitted", { exact: true }).first(),
    ).toBeVisible();

    // …and from the request list.
    await page.goto("/account/requests");
    await expect(page.getByText(requestCode)).toBeVisible();

    /*
     * FLOW B — same coffee, a different offer and warehouse: still refused.
     *
     * The offer page now answers this before the customer types: every offer
     * for a coffee with an active sample request shows that state and a link
     * to the surviving request instead of a control that cannot succeed. So
     * the refusal is no longer reachable by clicking, and the check has two
     * halves.
     */
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    await expect(
      page.getByRole("button", { name: "Request sample" }),
      "an offer still invited a second sample request for the same coffee",
    ).toHaveCount(0);
    // Both offers of this coffee report the state, not just the one used.
    await expect(page.getByText("Active sample request")).toHaveCount(2);
    await expect(
      page.getByRole("link", { name: "View request" }).first(),
    ).toBeVisible();

    /*
     * The server rule itself is still proven end to end, through the one path
     * that can genuinely still reach it: a page loaded *before* the request
     * existed, whose buttons are now stale. That is the real race this rule
     * guards — two tabs, or a back-button — rather than a scenario the UI no
     * longer offers.
     */
    const stalePage = staleTab;
    const staleTriggers = stalePage.getByRole("button", {
      name: "Request sample",
    });
    await expect(staleTriggers).toHaveCount(2);
    await staleTriggers.nth(1).click();
    const second = stalePage.getByRole("dialog");
    await second
      .getByRole("textbox")
      .fill("Second warehouse attempt for the same coffee.");
    await second.getByRole("button", { name: "Submit sample request" }).click();

    const refusal = second.getByRole("alert");
    await expect(refusal).toBeVisible({ timeout: 30_000 });
    const refusalText = await refusal.innerText();
    expect(refusalText).toContain("already have an active sample request");
    // The surviving request's code travels with the refusal.
    expect(refusalText).toContain(requestCode);
    // Nothing from the database reaches the customer.
    expect(refusalText).not.toMatch(/duplicate key|uq_inquiries|23505|violat/i);
    await stalePage.close();

    expect(problems.appErrors()).toEqual([]);
  });

  // ---------------------------------------------------------------- FLOW D --

  test("FLOW D + lifecycle: the Administrator finds the request, sees its context, and may take only the actions its lifecycle allows", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);

    // A PRODUCT inquiry alongside the sample request, created through the UI.
    await signInCustomer(page, people.customer);
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    // The offer-page trigger is "Commercial inquiry"; "Send request" is the
    // dialog's own submit, so the two are addressed separately.
    await page
      .getByRole("button", { name: "Commercial inquiry" })
      .first()
      .click();
    const productDialog = page.getByRole("dialog");
    await productDialog
      .getByRole("textbox")
      .fill("Phase 7 acceptance run: pricing and availability question.");
    await productDialog.getByRole("button", { name: "Send request" }).click();
    const productSuccess = productDialog.getByRole("status");
    await expect(productSuccess).toBeVisible({ timeout: 30_000 });
    const productCode = codeOf(await productSuccess.innerText());

    await page.context().clearCookies();
    await signInAdmin(page);

    // --- the Lead Inbox list, filtered by the database ---
    await page.goto("/admin/inquiries");
    await expect(
      page.getByRole("heading", { name: "Leads", level: 1 }),
    ).toBeVisible();

    await page.locator('input[name="q"]').fill(productCode);
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForURL(/q=/);
    await expect(page.getByRole("link", { name: productCode })).toBeVisible();
    // Search is a real query, not a client filter: one code, one row.
    await expect(page.locator("tbody tr")).toHaveCount(1);

    // A type filter that excludes it returns a real empty state.
    await page.locator('select[name="type"]').selectOption("SAMPLE_REQUEST");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText("No request matches this search."),
    ).toBeVisible();

    // --- the detail page ---
    await page.locator('select[name="type"]').selectOption("");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("link", { name: productCode }).click();
    await page.waitForURL(/\/admin\/inquiries\/[0-9a-f-]{36}$/);

    await expect(page.getByText("Product enquiry")).toBeVisible();
    await expect(page.getByText(people.customer.email)).toBeVisible();
    await expect(page.getByText("+201000000001")).toBeVisible();
    await expect(page.getByText("E2E P7 Trading")).toBeVisible();
    await expect(
      page.getByText("pricing and availability question"),
    ).toBeVisible();

    // A PRODUCT inquiry is never offered the sample-only actions the trigger
    // would reject.
    await expect(
      page.getByRole("button", { name: "Mark received" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close request" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record sample sent" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Record delivery" }),
    ).toHaveCount(0);
    // Nor is there a free dropdown of every status.
    await expect(page.locator('form select[name="status"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Mark received" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText(
      "Status updated",
    );

    // After RECEIVED, "Mark received" is no longer on offer.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Mark contacted" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark received" }),
    ).toHaveCount(0);

    expect(problems.appErrors()).toEqual([]);
  });

  // ------------------------------------------- sample lifecycle + FLOW E ----

  test("FLOW A/E: the Administrator walks the sample lifecycle, the customer sees each status, and CLOSED frees the coffee again", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    const { data: sample } = await service
      .from("inquiries")
      .select("id,request_code")
      .eq("user_id", people.customer.id)
      .eq("type", "SAMPLE_REQUEST")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(sample).toBeTruthy();

    await signInAdmin(page);
    await page.goto(`/admin/inquiries/${sample!.id}`);

    for (const label of [
      "Mark received",
      "Mark contacted",
      "Record sample sent",
      "Record delivery",
    ]) {
      await page.getByRole("button", { name: label }).click();
      await expect(page.locator("main").getByRole("status")).toContainText(
        "Status updated",
      );
      await page.reload();
    }

    // The timeline shows every transition, once each, in order.
    const timeline = page
      .getByRole("heading", { name: "Status history" })
      .locator("xpath=../..")
      .getByRole("listitem");
    await expect(timeline).toHaveCount(5);
    await expect(timeline.nth(4)).toContainText("Sample delivered");

    // The customer sees the recorded status in their own language.
    await page.context().clearCookies();
    await signInCustomer(page, people.customer);
    await page.goto(`/account/requests/${sample!.request_code}`);
    await expect(page.getByText("Sample delivered").first()).toBeVisible();

    /*
     * FLOW E — while the request is still active (DELIVERED is an active
     * status), the coffee offers no way to start another one. The offer page
     * reports the state instead, so the customer learns it before writing a
     * message rather than after sending one. The server-side refusal that
     * backs this is proven end to end in FLOW B, through a page loaded before
     * the request existed.
     */
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    await expect(
      page.getByRole("button", { name: "Request sample" }),
      "a second sample request was offered while one was still active",
    ).toHaveCount(0);
    await expect(page.getByText("Active sample request").first()).toBeVisible();

    // …and allowed once the Administrator closes it.
    await page.context().clearCookies();
    await signInAdmin(page);
    await page.goto(`/admin/inquiries/${sample!.id}`);
    await page.getByRole("button", { name: "Close request" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText(
      "Status updated",
    );
    await page.reload();
    // CLOSED is terminal: no action is offered at all.
    await expect(
      page.getByText(
        "This request is closed. No further status change is possible.",
      ),
    ).toBeVisible();

    await page.context().clearCookies();
    await signInCustomer(page, people.customer);
    const dialog = await openSampleDialog(page);
    await dialog.getByRole("textbox").fill("New request after closure.");
    await dialog.getByRole("button", { name: "Submit sample request" }).click();
    await expect(dialog.getByRole("status")).toBeVisible({ timeout: 30_000 });

    // The closed request and its history are untouched.
    await page.goto(`/account/requests/${sample!.request_code}`);
    await expect(page.getByText("Closed").first()).toBeVisible();
    await expect(page.getByText("Sample delivered").first()).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // ------------------------------------------------------ stale Admin page --

  test("a stale Administrator page is refused rather than overwriting newer state", async ({
    page,
    context,
  }) => {
    const { data: lead } = await service
      .from("inquiries")
      .select("id")
      .eq("user_id", people.customer.id)
      .eq("type", "PRODUCT")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    await signInAdmin(page);
    await page.goto(`/admin/inquiries/${lead!.id}`);

    // A second Administrator tab moves the request on.
    const other = await context.newPage();
    await other.goto(`/admin/inquiries/${lead!.id}`);
    await other.getByRole("button", { name: "Mark contacted" }).click();
    await expect(other.locator("main").getByRole("status")).toContainText(
      "Status updated",
    );
    await other.close();

    // The first page still believes the old status.
    await page.getByRole("button", { name: "Mark contacted" }).click();
    // Scoped to `main`: the Sonner toaster mounts its own empty live region,
    // which an unscoped `getByRole("alert")` matches first.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText("This request has changed");
    expect(await alert.innerText()).not.toMatch(
      /23514|trigger|constraint|invalid_inquiry/i,
    );
    // Nothing was overwritten.
    await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  });

  // ------------------------------------------------------ profile gating ----

  test("an incomplete profile is told what to complete, with a route to fix it", async ({
    page,
  }) => {
    await signInCustomer(page, people.incomplete);
    const dialog = await openSampleDialog(page);
    await dialog.getByRole("textbox").fill("A request without a full profile.");
    await dialog.getByRole("button", { name: "Submit sample request" }).click();

    const alert = dialog.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText("Complete your account information");
    await expect(
      alert.getByRole("link", { name: "Complete your account information" }),
    ).toBeVisible();

    // Nothing was stored.
    const { count } = await service
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", people.incomplete.id);
    expect(count ?? 0).toBe(0);
  });

  test("an empty message is refused inline, and the typed value survives", async ({
    page,
  }) => {
    await signInCustomer(page, people.customer);
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);
    // The offer-page trigger is "Commercial inquiry"; "Send request" is the
    // dialog's own submit, so the two are addressed separately.
    await page
      .getByRole("button", { name: "Commercial inquiry" })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    const message = dialog.getByRole("textbox");
    await message.fill("short");
    await dialog.getByRole("button", { name: "Send request" }).click();

    // Application-managed, not a native bubble: a real element below the field.
    const fieldError = dialog.locator("#inquiry-message-error");
    await expect(fieldError).toBeVisible({ timeout: 30_000 });
    await expect(fieldError).toContainText("at least 10 characters");
    await expect(message).toHaveAttribute("aria-invalid", "true");
    // The customer does not have to retype what they wrote.
    await expect(message).toHaveValue("short");
  });

  // ------------------------------------------------------- accessibility ----

  test("P7-T05: the dialog is fully operable from the keyboard", async ({
    page,
  }) => {
    await signInCustomer(page, people.customer);
    await page.goto(`/green-coffee-offer-list/${people.coffeeSlug}`);

    /*
     * The commercial control, not the sample one. This test is about the
     * dialog shell — both actions open the same `ModalDialog` with the same
     * form — and the sample control is legitimately absent whenever the
     * customer already holds an active request for this coffee, which earlier
     * tests in this serial block leave behind.
     */
    const trigger = page
      .getByRole("button", { name: "Commercial inquiry" })
      .first();
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // Named and described for assistive technology.
    await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);
    await expect(dialog).toHaveAttribute("aria-describedby", /.+/);

    // Focus moved into the dialog, onto the field rather than the close button.
    await expect(dialog.getByRole("textbox")).toBeFocused();

    // Tab cycles inside: from the last control it returns to the first.
    const inside = async () =>
      dialog.evaluate(
        (node) => node.contains(document.activeElement),
        undefined,
      );
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside(), `focus escaped after ${i + 1} tabs`).toBe(true);
    }
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await inside(), `focus escaped after ${i + 1} back-tabs`).toBe(
        true,
      );
    }

    // The background does not scroll while the dialog is open.
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    // Escape closes and returns focus to what opened it.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  // ------------------------------------------------------------ isolation --

  test("one customer cannot open another customer's request, by code or by Admin URL", async ({
    page,
  }) => {
    const { data: theirs } = await service
      .from("inquiries")
      .select("id,request_code")
      .eq("user_id", people.customer.id)
      .limit(1)
      .single();

    await signInCustomer(page, people.incomplete);
    const byCode = await page.request.get(
      `/account/requests/${theirs!.request_code}`,
      { maxRedirects: 0 },
    );
    expect(byCode.status()).toBe(404);

    // A guessed code that belongs to nobody answers identically, so a 404
    // never reveals that a request exists.
    const guessed = await page.request.get("/account/requests/HC-000000000", {
      maxRedirects: 0,
    });
    expect(guessed.status()).toBe(404);

    // The Admin surfaces are closed to a customer entirely.
    const adminList = await page.request.get("/admin/inquiries", {
      maxRedirects: 0,
    });
    expect([302, 307, 308, 404]).toContain(adminList.status());
    const adminDetail = await page.request.get(
      `/admin/inquiries/${theirs!.id}`,
      { maxRedirects: 0 },
    );
    expect([302, 307, 308, 404]).toContain(adminDetail.status());
  });

  // --------------------------------------------------------------- RTL -----

  test("the Arabic Lead Inbox is right-to-left and keeps identifiers left-to-right", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/ar/admin/inquiries");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    // Localized, not the raw enum.
    await expect(page.getByRole("option", { name: "طلب عينة" })).toHaveCount(1);

    const firstCode = page.locator("tbody tr").first().getByRole("link");
    await expect(firstCode).toHaveAttribute("dir", "ltr");

    // The page itself never scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
