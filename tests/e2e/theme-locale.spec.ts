import { expect, test } from "@playwright/test";
import { expectNoPriceLeak, horizontalTravel } from "./helpers";

test.describe("theme", () => {
  test("light and dark themes both render the header and logo", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "The header theme toggle is only exposed in the desktop header",
    );
    await page.goto("/", { waitUntil: "networkidle" });

    const toggle = page.getByRole("button", { name: /toggle color theme/i });
    await expect(toggle).toBeVisible();

    const html = page.locator("html");
    const initiallyDark = await html.evaluate((node) =>
      node.classList.contains("dark"),
    );

    await toggle.click();
    await expect
      .poll(() => html.evaluate((node) => node.classList.contains("dark")), {
        message: "theme toggle must flip the dark class",
      })
      .toBe(!initiallyDark);

    // Header and brand must stay visible in the toggled theme.
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("header img, header svg").first()).toBeVisible();

    await toggle.click();
    await expect
      .poll(() => html.evaluate((node) => node.classList.contains("dark")))
      .toBe(initiallyDark);
  });

  test("dark theme keeps body text readable against the background", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(colors.color).not.toBe(colors.background);
  });
});

test.describe("locale and RTL", () => {
  test("english pages are unprefixed and declare ltr", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("arabic pages use /ar, lang=ar and dir=rtl without overflow", async ({
    page,
  }) => {
    for (const route of ["/ar", "/ar/green-coffee-offer-list", "/ar/contact"]) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      expect(await horizontalTravel(page)).toBeLessThanOrEqual(1);
    }
  });

  test("locale switcher moves between english and arabic", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const switcher = page
      .getByRole("link", { name: /^(ar|العربية)$/i })
      .first();
    if ((await switcher.count()) === 0) {
      test.skip(true, "Locale switcher is not a link in this layout");
      return;
    }
    await switcher.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });
});

test.describe("navigation", () => {
  test("primary navigation reaches the catalog", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Desktop-only primary navigation",
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const catalogLink = page
      .locator('header a[href="/green-coffee-offer-list"]')
      .first();
    await expect(catalogLink).toBeVisible();
    await catalogLink.click();
    await page.waitForURL(/green-coffee-offer-list/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("mobile menu opens as a modal dialog, traps focus and closes on Escape", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction");
    // networkidle keeps the click after hydration so the dialog reliably opens.
    await page.goto("/", { waitUntil: "networkidle" });

    const trigger = page.locator('button[aria-haspopup="dialog"]').first();
    await expect(trigger).toBeVisible();
    // WCAG 2.2 target size: the trigger must be at least 44x44 CSS pixels.
    const box = await trigger.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // Focus must move somewhere inside the dialog (focus trap entry point).
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .querySelector('[role="dialog"]')
                ?.contains(document.activeElement) ?? false,
          ),
        { message: "focus must move into the mobile menu dialog" },
      )
      .toBe(true);
    // Background scroll is locked while the menu is open.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("mobile menu navigates and closes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction");
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator('button[aria-haspopup="dialog"]').first().click();
    const dialog = page.getByRole("dialog");
    const link = dialog.locator('a[href*="green-coffee-offer-list"]').first();
    if ((await link.count()) === 0) {
      test.skip(true, "Catalog link not present in mobile menu");
      return;
    }
    await link.click();
    await page.waitForURL(/green-coffee-offer-list/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoPriceLeak(page);
  });
});
