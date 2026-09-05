import { expect, test, type Page } from "@playwright/test";
import { collectRuntimeProblems, horizontalTravel } from "./helpers";
import { auditScreen, visitInTheme } from "./ui-audit";

/**
 * The regional contact enhancement: UAE and Egypt office cards, the map
 * facade, and the draggable WhatsApp control.
 *
 * The data assertions read the owner's values from the page rather than from
 * the config module on purpose. Importing `CONTACT_REGIONS` here would make
 * the suite agree with itself: it would keep passing if the cards stopped
 * rendering a phone number, because the expectation and the source would be
 * the same object. The literals below are the owner's brief.
 */

test.describe.configure({ mode: "default", timeout: 120_000 });

/*
 * Addresses are asserted per locale. The Arabic card is not the English one
 * with a different label on it: the generic parts of the address are written
 * in Arabic, while registered names ("DAMAC Smart Heights") stay in Latin
 * script because translating them would name a building that does not exist.
 * A single Latin pattern would therefore prove nothing about the Arabic page.
 */
/** The one address both offices are reached at, per the owner. */
const EMAIL = "hillscoffe732@gmail.com";

const UAE = {
  address: { en: /DAMAC Smart Heights/i, ar: /تيكوم|DAMAC Smart Heights/ },
  city: { en: /Dubai/i, ar: /دبي/ },
  hours: /10:00/,
  tel: ["tel:+971523618866", "tel:+97143230662"],
  /** Confirmed WhatsApp lines. The landline is deliberately not one. */
  whatsapp: ["https://wa.me/971523618866"],
  shownNumbers: ["+971 52 361 8866", "04 323 0662"],
  maps: "https://maps.app.goo.gl/7mh3nYbk4BSytV167",
};

const EGYPT = {
  address: { en: /Sheraton Residences/i, ar: /شيراتون ريزيدنس/ },
  city: { en: /Cairo/i, ar: /القاهرة/ },
  hours: /9:00/,
  tel: ["tel:+201117993300"],
  whatsapp: ["https://wa.me/201117993300"],
  shownNumbers: ["+20 111 799 3300"],
  maps: "https://maps.app.goo.gl/oEAXKwMMRqFqBchJ8",
};

const SOCIAL = [
  "https://www.instagram.com/hillscoffee.global",
  "https://www.facebook.com/share/14j8j2ftLg9/",
  "https://www.linkedin.com/company/hills-coffee-trading-llc/",
];

const card = (page: Page, id: "uae" | "egypt") => page.locator(`article#${id}`);

for (const locale of ["en", "ar"] as const) {
  const path = locale === "ar" ? "/ar/contact" : "/contact";

  test(`${locale}: both regional cards publish the owner's contact data`, async ({
    page,
  }) => {
    const problems = collectRuntimeProblems(page);
    await page.goto(path, { waitUntil: "networkidle" });

    for (const [id, data] of [
      ["uae", UAE],
      ["egypt", EGYPT],
    ] as const) {
      const region = card(page, id);
      await expect(region, `${id} card missing`).toBeVisible();

      const text = (await region.innerText()).replace(/\s+/g, " ");
      expect(text, `${id}: address`).toMatch(data.address[locale]);
      expect(text, `${id}: city`).toMatch(data.city[locale]);
      expect(text, `${id}: working hours`).toMatch(data.hours);

      // Every number is shown in the form the owner publishes …
      for (const shown of data.shownNumbers)
        expect(text, `${id}: displayed number ${shown}`).toContain(shown);

      // … and each has its own Call action.
      for (const href of data.tel)
        await expect(
          region.locator(`a[href="${href}"]`),
          `${id}: ${href}`,
        ).toHaveCount(1);

      // Maps and social links open safely in a new tab.
      for (const url of [data.maps, ...SOCIAL]) {
        const link = region.locator(`a[href^="${url}"]`).first();
        await expect(link, `${id}: link to ${url}`).toHaveCount(1);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
        // An icon-only or ambiguous link would strand a screen-reader user.
        expect(
          (await link.getAttribute("aria-label"))?.trim(),
          `${id}: accessible name for ${url}`,
        ).toBeTruthy();
      }
    }

    // The two maps must not both point at the same place.
    const uaeMaps = await card(page, "uae")
      .locator('a[href*="maps.app.goo.gl"]')
      .getAttribute("href");
    const egyptMaps = await card(page, "egypt")
      .locator('a[href*="maps.app.goo.gl"]')
      .getAttribute("href");
    expect(uaeMaps).not.toBe(egyptMaps);

    const found = problems.summary();
    expect(found.hydration, `${locale}: hydration`).toEqual([]);
    expect(found.pageErrors, `${locale}: page errors`).toEqual([]);
    expect(found.consoleErrors, `${locale}: console errors`).toEqual([]);
  });

  test(`${locale}: both offices offer a live e-mail action`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    for (const id of ["uae", "egypt"] as const) {
      const region = card(page, id);
      const live = region.locator(`a[href="mailto:${EMAIL}"]`);
      await expect(live, `${id}: mailto action`).toHaveCount(1);
      expect(
        (await live.getAttribute("aria-label"))?.trim(),
        `${id}: accessible name`,
      ).toBeTruthy();

      // The pending state is gone, and no placeholder token ever reached the
      // page — the two ways this could have shipped half-configured.
      await expect(
        region.getByTestId(`email-pending-${id}`),
        `${id}: stale pending chip`,
      ).toHaveCount(0);
      expect(await region.innerText()).not.toMatch(
        /REPLACE_WITH|coming soon|قريبا/i,
      );
    }
  });

  test(`${locale}: Call and WhatsApp are separate actions on the right lines`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    for (const [id, data] of [
      ["uae", UAE],
      ["egypt", EGYPT],
    ] as const) {
      const region = card(page, id);

      /*
       * WhatsApp must be an https `wa.me` link. A `tel:` here would hand the
       * click to the operating system's call-app chooser instead of opening
       * WhatsApp — the exact confusion these two buttons exist to remove.
       */
      for (const url of data.whatsapp) {
        const link = region.locator(`a[href="${url}"]`);
        await expect(link, `${id}: WhatsApp action ${url}`).toHaveCount(1);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
        expect(
          (await link.getAttribute("aria-label"))?.trim(),
          `${id}: WhatsApp accessible name`,
        ).toBeTruthy();
      }

      // No WhatsApp control may point at a `tel:` URI, anywhere in the card.
      const waHrefs = await region
        .locator('a[href*="wa.me"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("href") ?? ""),
        );
      expect(waHrefs.length, `${id}: WhatsApp count`).toBe(
        data.whatsapp.length,
      );
      for (const href of waHrefs) expect(href).toMatch(/^https:\/\/wa\.me\//);

      // Every Call action is a `tel:`, and there are exactly as many as there
      // are published numbers.
      const telHrefs = await region
        .locator('a[href^="tel:"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("href") ?? ""),
        );
      expect(telHrefs.sort(), `${id}: call actions`).toEqual(
        [...data.tel].sort(),
      );
    }

    /*
     * The UAE landline is callable but is not a WhatsApp line. Its number must
     * therefore carry a Call action and no WhatsApp action — asserted by
     * counting, since one WhatsApp link in that card is the mobile's.
     */
    const uae = card(page, "uae");
    await expect(uae.locator('a[href="tel:+97143230662"]')).toHaveCount(1);
    await expect(uae.locator('a[href*="wa.me/97143230662"]')).toHaveCount(0);
  });

  test(`${locale}: maps load only when asked, and then point at their own region`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    // Nothing third-party is embedded on arrival.
    await expect(page.locator("iframe")).toHaveCount(0);

    for (const [id, city] of [
      ["uae", "Dubai"],
      ["egypt", "Cairo"],
    ] as const) {
      await card(page, id).getByRole("button").first().click();
      const frame = card(page, id).locator("iframe");
      await expect(frame, `${id}: map did not appear`).toHaveCount(1);
      const src = decodeURIComponent((await frame.getAttribute("src")) ?? "");
      expect(src, `${id}: map location`).toContain(city);
      // No credential is required for, or present in, the default embed.
      expect(src, `${id}: unexpected API key`).not.toContain("key=");
      await expect(frame).toHaveAttribute("title", /\S/);
    }
  });
}

test("the floating WhatsApp control opens WhatsApp and can be moved", async ({
  page,
}) => {
  const problems = collectRuntimeProblems(page);
  await page.goto("/contact", { waitUntil: "networkidle" });

  const fab = page.getByTestId("whatsapp-fab");
  await expect(fab).toBeVisible();
  // The owner-confirmed UAE WhatsApp line, as https — never a `tel:` URI.
  expect(await fab.getAttribute("href")).toBe("https://wa.me/971523618866");
  await expect(fab).toHaveAttribute("target", "_blank");
  await expect(fab).toHaveAttribute("rel", /noopener/);
  expect((await fab.getAttribute("aria-label"))?.trim()).toBeTruthy();

  const before = (await fab.boundingBox())!;

  // Drag it across the viewport with the mouse.
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(160, 220, { steps: 12 });
  await page.mouse.up();

  const after = (await fab.boundingBox())!;
  expect(
    Math.hypot(after.x - before.x, after.y - before.y),
    "the control did not move",
  ).toBeGreaterThan(40);

  // Dragging must not have navigated anywhere.
  expect(new URL(page.url()).pathname).toBe("/contact");
  expect(page.context().pages()).toHaveLength(1);

  // The position survives a reload.
  await page.reload({ waitUntil: "networkidle" });
  const restored = (await page.getByTestId("whatsapp-fab").boundingBox())!;
  expect(Math.abs(restored.x - after.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(restored.y - after.y)).toBeLessThanOrEqual(2);

  const found = problems.summary();
  expect(found.hydration, "hydration after drag").toEqual([]);
  expect(found.pageErrors, "page errors after drag").toEqual([]);
  expect(found.consoleErrors, "console errors after drag").toEqual([]);
});

test("a plain click on the WhatsApp control still opens WhatsApp", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "networkidle" });

  /*
   * The drag guard suppresses the click that follows a drag. This proves it
   * does not also swallow an ordinary click — the failure mode where the
   * button becomes draggable and stops being a button.
   *
   * The listener runs on `document` after React's root handler, records
   * whether the click was already suppressed, and then blocks the navigation
   * itself so the test does not leave the page.
   */
  await page.evaluate(() => {
    (window as Window & { __waPrevented?: boolean | null }).__waPrevented =
      null;
    document.addEventListener("click", (event) => {
      (window as Window & { __waPrevented?: boolean | null }).__waPrevented =
        event.defaultPrevented;
      event.preventDefault();
    });
  });

  await page.getByTestId("whatsapp-fab").click();

  const prevented = await page.evaluate(
    () => (window as Window & { __waPrevented?: boolean | null }).__waPrevented,
  );
  expect(prevented, "the click never reached the document").not.toBeNull();
  expect(prevented, "a click without a drag must not be suppressed").toBe(
    false,
  );
});

test("the WhatsApp control can never be dragged out of the viewport", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  const fab = page.getByTestId("whatsapp-fab");
  const size = (await fab.boundingBox())!;
  const viewport = page.viewportSize()!;

  for (const target of [
    { x: -800, y: -800 },
    { x: viewport.width + 800, y: viewport.height + 800 },
  ]) {
    const start = (await fab.boundingBox())!;
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();

    const box = (await fab.boundingBox())!;
    expect(box.x, "left edge").toBeGreaterThanOrEqual(0);
    expect(box.y, "top edge").toBeGreaterThanOrEqual(0);
    expect(box.x + size.width, "right edge").toBeLessThanOrEqual(
      viewport.width,
    );
    expect(box.y + size.height, "bottom edge").toBeLessThanOrEqual(
      viewport.height,
    );
  }

  expect(await horizontalTravel(page), "page must not scroll sideways").toBe(0);
});

test("the WhatsApp control moves by touch without scrolling the page", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await context.newPage();
  await touchPage.goto("/contact", { waitUntil: "networkidle" });

  const fab = touchPage.getByTestId("whatsapp-fab");
  const before = (await fab.boundingBox())!;
  const scrollBefore = await touchPage.evaluate(() => window.scrollY);

  // A real touch drag: pointer events with a touch pointerType.
  await fab.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: before.x + before.width / 2,
    clientY: before.y + before.height / 2,
  });
  await fab.dispatchEvent("pointermove", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 120,
    clientY: 300,
  });
  await fab.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 120,
    clientY: 300,
  });

  const after = (await fab.boundingBox())!;
  expect(
    Math.hypot(after.x - before.x, after.y - before.y),
    "touch drag did not move the control",
  ).toBeGreaterThan(40);
  expect(await touchPage.evaluate(() => window.scrollY)).toBe(scrollBefore);
  expect(new URL(touchPage.url()).pathname).toBe("/contact");

  await context.close();
});

test("keyboard users can reach WhatsApp and reposition the control", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "networkidle" });
  const fab = page.getByTestId("whatsapp-fab");
  const before = (await fab.boundingBox())!;

  await fab.focus();
  await expect(fab).toBeFocused();
  // The description tells a screen-reader user the control can be moved.
  const described = await fab.getAttribute("aria-describedby");
  expect(described).toBeTruthy();
  expect(
    await page.locator(`#${described}`).textContent(),
    "hint text",
  ).toMatch(/\S/);

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  const after = (await fab.boundingBox())!;
  expect(after.x).toBeLessThan(before.x);
  expect(after.y).toBeLessThan(before.y);
  // Arrow keys must move the button, not scroll the document.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

/*
 * An explicit 375px pass. The `mobile` project is an iPhone 13 at 390px, and
 * the narrowest screen this project supports is 375 — the width at which the
 * previous phases found their real clipping defects.
 */
test("at 375px the contact page fits in both locales and both themes", async ({
  browser,
}) => {
  for (const locale of ["en", "ar"] as const)
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: 375, height: 780 },
      });
      const page = await context.newPage();
      const problems = collectRuntimeProblems(page);
      const label = `375/${locale}/${theme}`;

      await visitInTheme(
        page,
        locale === "ar" ? "/ar/contact" : "/contact",
        theme,
      );
      await expect(page.locator("article#uae"), label).toBeVisible();
      await expect(page.locator("article#egypt"), label).toBeVisible();

      await auditScreen(page, label);
      expect(await horizontalTravel(page), `${label}: sideways scroll`).toBe(0);

      // The floating control must stay inside a 375px screen, not hang off it.
      const fab = (await page.getByTestId("whatsapp-fab").boundingBox())!;
      expect(fab.x, `${label}: fab left`).toBeGreaterThanOrEqual(0);
      expect(fab.x + fab.width, `${label}: fab right`).toBeLessThanOrEqual(375);

      const found = problems.summary();
      expect(found.hydration, `${label}: hydration`).toEqual([]);
      expect(found.pageErrors, `${label}: page errors`).toEqual([]);
      expect(found.consoleErrors, `${label}: console errors`).toEqual([]);
      await context.close();
    }
});

test("the footer surfaces both regional desks and the company profiles", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  await expect(footer.locator('a[href$="/contact#uae"]')).toHaveCount(1);
  await expect(footer.locator('a[href$="/contact#egypt"]')).toHaveCount(1);
  for (const url of SOCIAL) {
    const link = footer.locator(`a[href^="${url}"]`);
    await expect(link, `footer link to ${url}`).toHaveCount(1);
    await expect(link).toHaveAttribute("rel", /noopener/);
    expect((await link.getAttribute("aria-label"))?.trim()).toBeTruthy();
  }
});

test("Organization structured data carries the confirmed offices and profiles", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const nodes = blocks.flatMap((raw) => {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  });

  const organization = nodes.find(
    (node) => (node as { "@type"?: string })["@type"] === "Organization",
  ) as
    | {
        sameAs?: string[];
        location?: { address?: { addressLocality?: string } }[];
      }
    | undefined;
  expect(organization, "no Organization node on /contact").toBeTruthy();
  expect(organization!.sameAs).toEqual(expect.arrayContaining(SOCIAL));
  expect(
    organization!.location?.map((place) => place.address?.addressLocality),
  ).toEqual(["Dubai", "Cairo"]);

  // The ContactPage node's reference must resolve to that Organization.
  const contactPage = nodes.find(
    (node) => (node as { "@type"?: string })["@type"] === "ContactPage",
  ) as { about?: { "@id"?: string } } | undefined;
  const organizationId = (
    nodes.find(
      (node) => (node as { "@type"?: string })["@type"] === "Organization",
    ) as { "@id"?: string }
  )["@id"];
  expect(contactPage?.about?.["@id"]).toBe(organizationId);

  // Days of the week were never supplied, so no opening hours may be claimed.
  expect(JSON.stringify(nodes)).not.toContain("openingHours");
});

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale} ${theme}: the contact page renders cleanly`, async ({
      page,
    }) => {
      const problems = collectRuntimeProblems(page);
      await visitInTheme(
        page,
        locale === "ar" ? "/ar/contact" : "/contact",
        theme,
      );

      const shell = await page.evaluate(() => ({
        dir: document.documentElement.getAttribute("dir"),
        lang: document.documentElement.getAttribute("lang"),
      }));
      expect(shell.dir).toBe(locale === "ar" ? "rtl" : "ltr");
      expect(shell.lang).toBe(locale);

      // The number itself carries the isolation, so Arabic around it cannot
      // reorder the digits. Asserting the text proves the isolation worked.
      const number = page.locator('article#uae span[dir="ltr"]').first();
      await expect(number).toHaveText("+971 52 361 8866");

      await auditScreen(page, `contact/${locale}/${theme}`);
      expect(
        await horizontalTravel(page),
        "contact page must not scroll sideways",
      ).toBe(0);

      const found = problems.summary();
      expect(found.hydration).toEqual([]);
      expect(found.pageErrors).toEqual([]);
      expect(found.consoleErrors).toEqual([]);
    });
  }
}
