import { expect, test } from "@playwright/test";
import { rawResponse } from "./helpers";

test.describe("anonymous routing and auth boundaries", () => {
  test("customer account routes redirect anonymous visitors to sign-in", async ({
    page,
  }) => {
    for (const path of ["/account", "/account/profile", "/account/favorites"]) {
      const response = await rawResponse(page, path);
      expect(response.status(), `${path} must issue a real redirect`).toBe(307);
      expect(response.headers()["location"]).toMatch(
        /\/sign-in\?next=%2Faccount/,
      );
    }
  });

  test("admin routes redirect anonymous visitors to the canonical admin entry", async ({
    page,
  }) => {
    for (const path of ["/admin", "/admin/products", "/admin/settings"]) {
      const response = await rawResponse(page, path);
      expect(response.status(), `${path} must issue a real redirect`).toBe(307);
      expect(response.headers()["location"]).toMatch(/\/dashboard-admin$/);
    }
  });

  test("legacy /admin/login permanently redirects to /dashboard-admin", async ({
    page,
  }) => {
    const english = await rawResponse(page, "/admin/login");
    expect(english.status()).toBe(308);
    expect(english.headers()["location"]).toMatch(/\/dashboard-admin$/);

    const arabic = await rawResponse(page, "/ar/admin/login");
    expect(arabic.status()).toBe(308);
    expect(arabic.headers()["location"]).toMatch(/\/ar\/dashboard-admin$/);
  });

  test("arabic account and admin routes keep the /ar prefix when redirecting", async ({
    page,
  }) => {
    const account = await rawResponse(page, "/ar/account");
    expect(account.status()).toBe(307);
    expect(account.headers()["location"]).toMatch(
      /\/ar\/sign-in\?next=%2Far%2Faccount/,
    );

    const admin = await rawResponse(page, "/ar/admin");
    expect(admin.status()).toBe(307);
    expect(admin.headers()["location"]).toMatch(/\/ar\/dashboard-admin$/);
  });

  test("canonical admin login page renders for anonymous visitors", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard-admin", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    // Admin sign-up must never be exposed.
    await expect(
      page.getByRole("link", { name: /create account/i }),
    ).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("arabic admin login renders in Arabic", async ({ page }) => {
    const response = await page.goto("/ar/dashboard-admin", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("verify-email renders with an email query parameter", async ({
    page,
  }) => {
    const response = await page.goto(
      "/verify-email?email=qa.example%40example.com",
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /resend|send/i }),
    ).toBeVisible();

    const arabic = await page.goto(
      "/ar/verify-email?email=qa.example%40example.com",
      { waitUntil: "domcontentloaded" },
    );
    expect(arabic?.status()).toBe(200);
  });

  test("unknown routes return a real 404 status, not a soft 200", async ({
    page,
  }) => {
    // Regression guard: these previously streamed a 200 shell with 404 content.
    for (const path of [
      "/nonexistent-xyz-404",
      "/green-coffee-offer-list/definitely-not-a-real-lot",
      "/coffee-origins/definitely-not-a-real-origin",
      "/knowledge/definitely-not-a-real-article",
      "/ar/nonexistent-xyz-404",
    ]) {
      const response = await rawResponse(page, path);
      expect(response.status(), `${path} must be a real 404`).toBe(404);
    }
  });

  test("private routes are excluded from robots and sitemap", async ({
    page,
  }) => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow:\s*\/account/);
    expect(robots).toMatch(/Disallow:\s*\/admin/);

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/account");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/dashboard-admin");
  });
});

test.describe("authenticated personas", () => {
  // Personas B (unverified USER), C (verified USER) and D (ADMIN) from §74/§75
  // cannot be exercised without approved staging credentials. Sessions are
  // never fabricated, so these remain explicitly blocked rather than faked.
  test.skip("BLOCKED — STAGING CREDENTIALS REQUIRED: verified user and admin flows", () => {});
});
