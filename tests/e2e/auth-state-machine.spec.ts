import { expect, test, type Page } from "@playwright/test";
import {
  createAuthFixtureSet,
  hasAuthFixtureCredentials,
  type AuthFixtureSet,
} from "./auth-fixtures";

test.describe("Phase 3 real Auth state machine", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real persona writes run once on desktop; mobile/Auth layout is covered by the shared responsive suites.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial" });

  let fixtures!: AuthFixtureSet;

  test.beforeAll(async ({}, workerInfo) => {
    fixtures = await createAuthFixtureSet(workerInfo.project.name);
  });

  test.afterAll(async () => {
    await fixtures?.cleanup();
  });

  async function submitCredentials(
    page: Page,
    path: string,
    persona: { email: string; password: string },
  ) {
    await page.goto(path);
    await page.locator('input[name="email"]').fill(persona.email);
    await page.locator('input[name="password"]').fill(persona.password);
    await page.locator('button[type="submit"]').click();
  }

  test("signup contract exposes optional company and no role/Admin signup", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await expect(page.locator('input[name="fullName"]')).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('input[name="email"]')).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('input[name="phone"]')).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('input[name="companyName"]')).not.toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('input[name="password"]')).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('input[name="confirmPassword"]')).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.locator('[name="role"]')).toHaveCount(0);
    await expect(page.getByText(/admin signup/i)).toHaveCount(0);
  });

  test("unverified USER receives verification-required and no session capability", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.unverified);
    await expect(
      page.getByRole("alert").filter({ hasText: /confirm your email/i }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });

  test("verified USER reaches customer account in EN and AR", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.verified);
    await expect(page).toHaveURL(/\/account$/);

    await page.context().clearCookies();
    await submitCredentials(page, "/ar/sign-in", fixtures.verified);
    await expect(page).toHaveURL(/\/ar\/account$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("blocked USER is denied and the attempted login session is cleared", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.blocked);
    await expect(
      page.getByRole("alert").filter({ hasText: /access is restricted/i }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });

  test("an active USER session loses capability on the next request after blocking", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.midBlock);
    await expect(page).toHaveURL(/\/account$/);
    await fixtures.block(fixtures.midBlock);
    await page.goto("/account/profile");
    await expect(page).toHaveURL(/\/sign-in\?error=blocked$/);
    await expect(page.getByRole("status")).toContainText(
      /access is restricted/i,
    );
  });

  test("ADMIN at customer sign-in is signed out and directed to the Admin portal", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.admin);
    await expect(
      page.getByRole("alert").filter({ hasText: /Admin portal/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /open admin portal/i }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });

  test("USER at Admin entry is denied while ADMIN reaches the workspace", async ({
    page,
  }) => {
    await submitCredentials(page, "/dashboard-admin", fixtures.verified);
    await expect(
      page.getByRole("alert").filter({ hasText: /cannot access/i }),
    ).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard-admin$/);

    await submitCredentials(page, "/dashboard-admin", fixtures.admin);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("customer and Admin sign-out clear their protected sessions", async ({
    page,
  }) => {
    await submitCredentials(page, "/sign-in", fixtures.verified);
    await expect(page).toHaveURL(/\/account$/);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=/);

    await submitCredentials(page, "/dashboard-admin", fixtures.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/account");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard-admin$/);
  });

  test("genuine recovery token is single-use and reset invalidates its session", async ({
    page,
  }) => {
    const recoveryLink = await fixtures.recoveryCallback(fixtures.recovery);
    const newPassword = `P3-New-${Math.random().toString(36).slice(2)}!Aa9`;

    await page.goto(recoveryLink);
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.locator('input[name="password"]')).toBeVisible();

    const protectedPage = await page.context().newPage();
    await protectedPage.goto("/account");
    await expect(protectedPage).toHaveURL(/\/reset-password$/);
    await protectedPage.close();

    await page.locator('input[name="password"]').fill(newPassword);
    await page.locator('input[name="confirmPassword"]').fill(newPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/sign-in\?reset=success$/);

    await submitCredentials(page, "/sign-in", fixtures.recovery);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /check your email and password/i }),
    ).toBeVisible();

    await submitCredentials(page, "/sign-in", {
      ...fixtures.recovery,
      password: newPassword,
    });
    await expect(page).toHaveURL(/\/account$/);

    await page.context().clearCookies();
    await page.goto(recoveryLink);
    await expect(page).toHaveURL(/\/sign-in\?error=link_expired$/);
  });

  test("three-minute waiting UX does not delete or invalidate the account", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto(
      `/verify-email?email=${encodeURIComponent(fixtures.unverified.email)}`,
    );
    await expect(
      page.getByText(/waiting for email confirmation/i),
    ).toBeVisible();
    await page.clock.fastForward(181_000);
    await expect(page.getByText(/still awaiting verification/i)).toBeVisible();
    expect(await fixtures.userStillExists(fixtures.unverified.id)).toBe(true);
  });

  test("resend cooldown remains enforced after client state is reset", async ({
    page,
  }) => {
    const path = `/verify-email?email=${encodeURIComponent(fixtures.unverified.email)}`;
    await page.goto(path);
    await page.getByRole("button", { name: /resend/i }).click();
    await page.reload();
    await page.getByRole("button", { name: /resend/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /wait before requesting/i }),
    ).toBeVisible();
  });

  test("malformed and wrong-context callbacks never reach protected destinations", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=invalid&next=%2Faccount");
    await expect(page).toHaveURL(/\/verify-email\?error=link_expired$/);
    await page.goto("/reset-password");
    await expect(
      page.getByRole("alert").filter({ hasText: /invalid|no longer active/i }),
    ).toBeVisible();
  });
});
