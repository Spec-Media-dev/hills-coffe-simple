import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { mkdirSync } from "node:fs";
import { collectRuntimeProblems, devOverlayError } from "./helpers";
import { auditScreen } from "./ui-audit";
import {
  hasP12Fixtures,
  p12PersonaId,
  p12Run,
  signInAs,
  type P12Persona,
} from "./p12-fixtures";

/**
 * P12-T05 — authenticated visual regression baselines.
 *
 * Captures every required authenticated surface across EN/AR, light/dark and
 * desktop/375, and validates each one technically with the suite's existing
 * `auditScreen` gate (raw translation keys, broken images, unreadable text,
 * genuine horizontal overflow) plus direction, dialog geometry and a clean
 * runtime. Reusing that helper matters: it already knows the difference
 * between a page that scrolls sideways and a wide table inside its own
 * scroller, which a naive scrollWidth check would fail.
 *
 * Baselines are written to the gitignored run directory, never into the repo.
 * Several of these screens legitimately show protected per-kg pricing to a
 * verified customer or an Administrator, and committing those images would put
 * protected commercial data into a shared artifact. The owner reviews them
 * locally. Nothing here approves a baseline — that is the owner's call.
 */

test.describe.configure({ mode: "serial", timeout: 900_000 });

test.skip(
  !hasP12Fixtures,
  "P12 fixtures unavailable — run `node scripts/e2e/seed.mjs` first",
);

const OUT = `tests/e2e/.p12-runs/visual/${p12Run?.runId ?? "none"}`;

type Surface = {
  name: string;
  persona: P12Persona;
  path: (fixtureUserId: string) => string;
};

const SURFACES: Surface[] = [
  { name: "account", persona: "verified", path: () => "/account" },
  {
    name: "account-settings",
    persona: "verified",
    path: () => "/account/settings",
  },
  {
    name: "account-favorites",
    persona: "verified",
    path: () => "/account/favorites",
  },
  {
    name: "account-requests",
    persona: "verified",
    path: () => "/account/requests",
  },
  { name: "admin-dashboard", persona: "admin", path: () => "/admin" },
  { name: "admin-users", persona: "admin", path: () => "/admin/users" },
  {
    name: "admin-user-detail",
    persona: "admin",
    path: (id) => `/admin/users/${id}`,
  },
  {
    name: "admin-lead-inbox",
    persona: "admin",
    path: () => "/admin/inquiries",
  },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "m375", width: 375, height: 780 },
] as const;

/** next-themes reads the persisted choice on first paint, so seed it up front. */
async function themedContext(
  browser: Browser,
  width: number,
  height: number,
  theme: "light" | "dark",
): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem("theme", value);
    } catch {
      // A blocked storage API must not stop the visit.
    }
  }, theme);
  return context;
}

async function expectCleanRuntime(
  page: Page,
  problems: ReturnType<typeof collectRuntimeProblems>,
  label: string,
) {
  const found = problems.summary();
  expect(found.hydration, `${label}: hydration error`).toEqual([]);
  expect(found.pageErrors, `${label}: page error`).toEqual([]);
  expect(found.consoleErrors, `${label}: console.error`).toEqual([]);
  expect(await devOverlayError(page), `${label}: dev overlay error`).toBeNull();
}

test("captures and validates the authenticated visual baseline", async ({
  browser,
}) => {
  mkdirSync(OUT, { recursive: true });
  const captured: string[] = [];
  const fixtureUserId = p12PersonaId("blocked");

  for (const surface of SURFACES)
    for (const locale of ["en", "ar"] as const)
      for (const viewport of VIEWPORTS)
        for (const theme of ["light", "dark"] as const) {
          const label = `${surface.name}/${locale}/${viewport.name}/${theme}`;
          const context = await themedContext(
            browser,
            viewport.width,
            viewport.height,
            theme,
          );
          const page = await context.newPage();
          const problems = collectRuntimeProblems(page);

          await signInAs(page, surface.persona, locale);
          const prefix = locale === "ar" ? "/ar" : "";
          await page.goto(`${prefix}${surface.path(fixtureUserId)}`, {
            waitUntil: "networkidle",
          });

          // The theme must have actually applied before anything is measured;
          // a screenshot taken mid-swap proves nothing about either theme.
          await expect
            .poll(
              () =>
                page.evaluate(() =>
                  document.documentElement.classList.contains("dark")
                    ? "dark"
                    : "light",
                ),
              { message: `${label}: theme did not apply` },
            )
            .toBe(theme);

          const shell = await page.evaluate(() => ({
            dir: document.documentElement.getAttribute("dir"),
            lang: document.documentElement.getAttribute("lang"),
            hasMain: Boolean(document.querySelector("main")),
          }));
          expect(shell.hasMain, `${label}: no main region`).toBe(true);
          expect(shell.dir, `${label}: direction`).toBe(
            locale === "ar" ? "rtl" : "ltr",
          );
          expect(shell.lang, `${label}: lang`).toBe(locale);

          await auditScreen(page, label);
          await expectCleanRuntime(page, problems, label);

          await page.screenshot({
            path: `${OUT}/${surface.name}-${locale}-${viewport.name}-${theme}.png`,
            fullPage: true,
          });
          captured.push(label);
          await context.close();
        }

  console.log(
    `P12T05 captured ${captured.length} authenticated baselines -> ${OUT}`,
  );
  expect(captured.length).toBe(SURFACES.length * 2 * VIEWPORTS.length * 2);
});

test("the mobile authenticated menus open without clipping", async ({
  browser,
}) => {
  mkdirSync(OUT, { recursive: true });
  for (const locale of ["en", "ar"] as const) {
    const context = await themedContext(browser, 375, 780, "light");
    const page = await context.newPage();
    const problems = collectRuntimeProblems(page);
    await signInAs(page, "verified", locale);
    await page.goto(`${locale === "ar" ? "/ar" : ""}/account`, {
      waitUntil: "networkidle",
    });

    const toggle = page.getByRole("button", { name: /menu|القائمة/i }).first();
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/mobile-menu-${locale}.png` });
      const stranded = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        return Array.from(
          document.querySelectorAll<HTMLElement>("nav a, nav button"),
        )
          .filter((element) => {
            if (element.offsetParent === null) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > limit + 1 || rect.left < -1);
          })
          .map((element) => element.textContent?.trim().slice(0, 24) ?? "");
      });
      expect(
        stranded,
        `mobile menu ${locale}: items outside the viewport`,
      ).toEqual([]);
      await page.keyboard.press("Escape");
    }
    await expectCleanRuntime(page, problems, `mobile-menu/${locale}`);
    await context.close();
  }
  console.log("P12T05 mobile authenticated menu validated in EN and AR");
});

test("the block/unblock dialog renders correctly in both directions", async ({
  browser,
}) => {
  mkdirSync(OUT, { recursive: true });
  for (const locale of ["en", "ar"] as const)
    for (const theme of ["light", "dark"] as const) {
      const label = `block-dialog/${locale}/${theme}`;
      const context = await themedContext(browser, 1440, 900, theme);
      const page = await context.newPage();
      const problems = collectRuntimeProblems(page);
      await signInAs(page, "admin", locale);
      await page.goto(
        `${locale === "ar" ? "/ar" : ""}/admin/users/${p12PersonaId("blocked")}`,
        { waitUntil: "networkidle" },
      );

      /*
       * Opening the dialog is all this test does to the fixture user — it
       * never submits. The block transition itself is proven in the persona
       * matrix; here the question is only whether the dialog is laid out
       * correctly in RTL.
       */
      const opener = page
        .getByRole("button", { name: /^block$|^unblock$|حظر|رفع/i })
        .first();
      expect(
        await opener.count(),
        `${label}: no block control`,
      ).toBeGreaterThan(0);
      await opener.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog, `${label}: dialog did not open`).toBeVisible({
        timeout: 15_000,
      });
      await page.screenshot({
        path: `${OUT}/block-dialog-${locale}-${theme}.png`,
      });

      const box = await dialog.boundingBox();
      expect(box, `${label}: dialog has no box`).not.toBeNull();
      expect(
        box!.x,
        `${label}: dialog off the leading edge`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        box!.x + box!.width,
        `${label}: dialog off the trailing edge`,
      ).toBeLessThanOrEqual(1441);
      expect(box!.width, `${label}: dialog collapsed`).toBeGreaterThan(200);

      await page.keyboard.press("Escape");
      await expect(
        dialog,
        `${label}: Escape did not close the dialog`,
      ).toBeHidden({ timeout: 10_000 });
      await expectCleanRuntime(page, problems, label);
      await context.close();
    }
  console.log("P12T05 block/unblock dialog validated in EN/AR x light/dark");
});
