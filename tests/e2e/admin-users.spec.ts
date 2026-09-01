import { expect, test, type Page } from "@playwright/test";
import {
  createAdminUsersFixtureSet,
  hasAuthFixtureCredentials,
  type AdminUsersFixtureSet,
} from "./admin-users-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 5 — the Admin Users workspace driven as a real Administrator against
 * the real database: search, filter, pagination, detail, block and unblock.
 *
 * Every account touched here is a per-run tagged fixture. Searches are scoped
 * by that tag so the assertions cannot accidentally depend on — or disturb —
 * any real account.
 */
test.describe("Phase 5 Admin Users workspace", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real persona writes run once on desktop; Admin responsive work is Phase 10.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  // Seeding a full second page of real accounts, and driving two browser
  // contexts in the blocking test, both take longer than the default budget.
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let fixtures!: AdminUsersFixtureSet;

  test.beforeAll(async ({}, workerInfo) => {
    test.setTimeout(180_000);
    fixtures = await createAdminUsersFixtureSet(workerInfo.project.name);
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    await fixtures?.cleanup();
  });

  async function signInAsAdmin(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(fixtures.admin.email);
    await page.locator('input[name="password"]').fill(fixtures.admin.password);
    await page.locator('button[type="submit"]').click();
    // Phase 3 routes post-auth navigation through a canonical document hop
    // (`/{locale}/continue`), so the final URL arrives a redirect later.
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  function rows(page: Page) {
    return page.locator("table tbody tr");
  }

  /** The contact column, which carries the email address. */
  function emailCells(page: Page) {
    return page.locator("table tbody tr td:nth-child(2)");
  }

  async function searchByTag(page: Page, extra = "") {
    await page.goto(`/admin/users?name=${fixtures.tag}${extra}`);
    await expect(page.locator("table")).toBeVisible();
  }

  test("the Admin overview renders real metrics in EN and AR (P5-T01)", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAsAdmin(page);

    // Every stat is a live aggregate. The dashboard is verified here rather
    // than rebuilt: what must hold is that the numbers come from the database
    // and that the route is Admin-only.
    const stats = page.locator("article strong");
    await expect(stats).toHaveCount(4);
    for (const value of await stats.allInnerTexts())
      expect(value.trim()).toMatch(/^[\d,.٠-٩٫٬]+$/);

    // The low-stock figure follows the site_settings threshold, so it cannot
    // be a hardcoded constant.
    await expect(page.getByText(/low/i).first()).toBeVisible();

    await page.goto("/ar/admin");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      /admin/i,
    );
    await expect(page.locator("article strong")).toHaveCount(4);

    expect(problems.appErrors()).toEqual([]);
  });

  test("an Administrator reaches the workspace and sees real customer data", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAsAdmin(page);
    // Reached from the Admin navigation, not by typing a URL.
    await page.locator('a[href$="/admin/users"]').first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await searchByTag(page);
    // 21 seeded customers; the first page holds the 20-row page size.
    await expect(rows(page)).toHaveCount(20);
    // Scoped to the workspace: the Sonner toaster is also an aria-live region.
    await expect(page.locator('main p[aria-live="polite"]')).toContainText(
      "21",
    );
    // Neither Administrator may appear in the customer directory.
    const listed = (await emailCells(page).allInnerTexts()).join("|");
    expect(listed).not.toContain(fixtures.admin.email);
    expect(listed).not.toContain(fixtures.otherAdmin.email);
    expect(problems.appErrors()).toEqual([]);
  });

  test("search by email and by name narrows to the expected customer", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    const target = fixtures.customers[5];

    await page.goto(`/admin/users?email=${encodeURIComponent(target.email)}`);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText(target.email)).toBeVisible();

    // Case-insensitive, partial name match.
    await page.goto(
      `/admin/users?name=${encodeURIComponent(target.fullName.toUpperCase())}`,
    );
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText(target.email)).toBeVisible();

    await page.goto("/admin/users?email=no-such-customer-anywhere");
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("the blocked filter reflects real durable state", async ({ page }) => {
    await signInAsAdmin(page);

    await searchByTag(page, "&blocked=blocked");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText(fixtures.blocked.email)).toBeVisible();

    await searchByTag(page, "&blocked=active");
    await expect(rows(page)).toHaveCount(20);
    await expect(page.getByText(fixtures.blocked.email)).toHaveCount(0);
  });

  test("pagination is server-side and stable across pages", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await searchByTag(page);
    const firstPageEmails = (await emailCells(page).allInnerTexts()).join("|");

    await page.getByRole("link", { name: /next|التالي/i }).click();
    await expect(page).toHaveURL(/page=2/);
    // 21 customers over a 20-row page: exactly one row on page two.
    await expect(rows(page)).toHaveCount(1);
    const secondPageEmail = (await emailCells(page).allInnerTexts())[0];
    expect(firstPageEmails).not.toContain(secondPageEmail);

    // The active search survives paging.
    await expect(page).toHaveURL(new RegExp(`name=${fixtures.tag}`));

    await page.getByRole("link", { name: /previous|السابق/i }).click();
    await expect(rows(page)).toHaveCount(20);
  });

  test("customer detail shows approved fields and a read-only avatar", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto(`/admin/users/${fixtures.withAvatar.id}`);

    await expect(
      page.getByRole("heading", { name: fixtures.withAvatar.fullName }),
    ).toBeVisible();
    await expect(page.getByText(fixtures.withAvatar.email)).toBeVisible();
    // The avatar renders from a server-minted signed URL.
    const avatar = page.locator("header img").first();
    await expect(avatar).toBeVisible();
    expect(await avatar.getAttribute("src")).toBeTruthy();

    // Nothing on this page can write the customer's avatar.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /upload|remove photo|delete photo/i }),
    ).toHaveCount(0);
    // Nor their role.
    await expect(page.locator('select[name="role"]')).toHaveCount(0);
  });

  test("blocking a customer is durable, reasoned, and immediately enforced", async ({
    page,
    context,
  }) => {
    await signInAsAdmin(page);
    const target = fixtures.customers[3];

    // The customer holds a live session before the block.
    const customerContext = await context.browser()!.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto("/sign-in");
    await customerPage.locator('input[name="email"]').fill(target.email);
    await customerPage.locator('input[name="password"]').fill(target.password);
    await customerPage.locator('button[type="submit"]').click();
    await expect(customerPage).toHaveURL(/\/account$/);

    await page.goto(`/admin/users/${target.id}`);
    await page.getByRole("button", { name: /^block$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('textarea[name="reason"]').fill("E2E policy review");
    await dialog.locator('button[type="submit"]').click();

    await expect(page.getByText(/blocked on/i)).toBeVisible();
    expect(await fixtures.isBlocked(target.id)).toBe(true);
    expect(await fixtures.blockReasonOf(target.id)).toBe("E2E policy review");

    // The already-issued customer session loses protected capability on its
    // very next request, with no sign-out step in between (SC-004).
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/sign-in/);
    await customerContext.close();
  });

  test("unblocking restores access without creating a session", async ({
    page,
    context,
  }) => {
    await signInAsAdmin(page);
    const target = fixtures.customers[3];

    await page.goto(`/admin/users/${target.id}`);
    await page.getByRole("button", { name: /unblock|restore/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('button[type="submit"]').click();
    await expect(page.getByText(/normal access/i)).toBeVisible();
    expect(await fixtures.isBlocked(target.id)).toBe(false);
    // The internal reason is cleared rather than retained across the cycle.
    expect(await fixtures.blockReasonOf(target.id)).toBeNull();

    // A brand-new browser context proves no session was handed to the
    // customer by the unblock itself (FR-028).
    const customerContext = await context.browser()!.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/sign-in/);
    await customerContext.close();
  });

  test("an Administrator cannot be blocked and cannot block themselves", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    // Another Administrator is not a customer, so the directory 404s rather
    // than confirming the account exists.
    const other = await page.goto(`/admin/users/${fixtures.otherAdmin.id}`);
    expect(other?.status()).toBe(404);
    const self = await page.goto(`/admin/users/${fixtures.admin.id}`);
    expect(self?.status()).toBe(404);

    expect(await fixtures.isBlocked(fixtures.otherAdmin.id)).toBe(false);
    expect(await fixtures.isBlocked(fixtures.admin.id)).toBe(false);
  });

  test("a verified customer cannot reach the workspace at all", async ({
    page,
  }) => {
    const target = fixtures.customers[7];
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(target.email);
    await page.locator('input[name="password"]').fill(target.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/account$/);

    for (const path of [
      "/admin/users",
      `/admin/users/${fixtures.customers[8].id}`,
      "/ar/admin/users",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/dashboard-admin/);
    }
  });

  test("anonymous visitors are sent to the Admin entry, not the workspace", async ({
    page,
  }) => {
    for (const path of ["/admin/users", "/ar/admin/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/dashboard-admin/);
    }
  });

  test("the workspace is fully localized in Arabic and renders RTL", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAsAdmin(page);
    await page.goto(`/ar/admin/users?name=${fixtures.tag}`);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // No English copy leaks into the Arabic workspace.
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).not.toHaveText(/customers/i);
    await expect(page.getByRole("button", { name: "تطبيق" })).toBeVisible();

    await page.goto(`/ar/admin/users/${fixtures.withAvatar.id}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("button", { name: /حظر|رفع الحظر/ }),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  test("no public navigation advertises the Admin portal", async ({ page }) => {
    for (const path of ["/", "/ar"]) {
      await page.goto(path);
      await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
      await expect(page.locator('a[href*="dashboard-admin"]')).toHaveCount(0);
    }
  });
});
