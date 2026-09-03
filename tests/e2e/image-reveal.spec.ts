import { expect, test, type Page } from "@playwright/test";
import { visitInTheme } from "./ui-audit";

/**
 * The `ImageReveal` wipe, checked in more than one engine.
 *
 * The primitive used to observe the very element it clipped. Chromium
 * subtracts `clip-path` when it computes an intersection rectangle, so an
 * element resting at `inset(0 0 100%)` reported a ratio of exactly 0 wherever
 * it sat on screen: it could never be seen, so it was never revealed, and the
 * image stayed clipped away while its layout box, its network request and its
 * decoded bitmap all looked healthy. Firefox reports 1 for the same element,
 * so the site looked correct there and the existing Chromium-only suite had
 * nothing to compare against.
 *
 * These tests therefore assert the finished state rather than the animation,
 * and are meant to run under `playwright.crossbrowser.config.ts`.
 */

/** Scrolls the whole page so every viewport-triggered reveal has fired. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

type RevealState = {
  index: number;
  clipPath: string;
  clipped: boolean;
  naturalWidth: number;
  boxWidth: number;
  boxHeight: number;
  flat: boolean | null;
};

/**
 * Reports every reveal on the page: whether its clip is still closed, and
 * whether the image inside it actually decoded to something with detail.
 *
 * The bitmap is sampled through a canvas — same-origin, so readback is
 * allowed — because a decoded image and a *visible* one are different claims,
 * and this regression made exactly that distinction matter.
 */
async function readReveals(page: Page): Promise<RevealState[]> {
  return page.evaluate(() => {
    const clips = [...document.querySelectorAll('[data-motion="image-clip"]')];
    return clips.map((clip, index) => {
      const style = getComputedStyle(clip as HTMLElement);
      const clipPath = style.clipPath;
      // A closed wipe ends in a large bottom inset; an open one ends at 0.
      const clipped = /inset\([^)]*?(?:\b[1-9]\d(?:\.\d+)?%|100%)\s*\)/.test(
        clipPath,
      );
      const img = clip.querySelector("img");
      const rect = (img ?? (clip as HTMLElement)).getBoundingClientRect();

      let flat: boolean | null = null;
      if (img && img.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 8;
          canvas.height = 8;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(img, 0, 0, 8, 8);
            const { data } = context.getImageData(0, 0, 8, 8);
            let min = 255;
            let max = 0;
            for (let i = 0; i < data.length; i += 4) {
              const luma =
                0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              min = Math.min(min, luma);
              max = Math.max(max, luma);
            }
            flat = max - min < 2;
          }
        } catch {
          flat = null; // tainted canvas: not something this test can judge
        }
      }

      return {
        index,
        clipPath,
        clipped,
        naturalWidth: img?.naturalWidth ?? 0,
        boxWidth: Math.round(rect.width),
        boxHeight: Math.round(rect.height),
        flat,
      };
    });
  });
}

function describeFailures(states: RevealState[], label: string) {
  return states
    .filter((state) => state.clipped)
    .map(
      (state) =>
        `${label} reveal #${state.index} still clipped: ${state.clipPath} (natural ${state.naturalWidth}px, box ${state.boxWidth}x${state.boxHeight})`,
    )
    .join("\n");
}

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 720 },
  { name: "1440", width: 1440, height: 900 },
] as const;

test.describe("ImageReveal renders its image in every engine", () => {
  for (const viewport of VIEWPORTS)
    for (const locale of ["en", "ar"] as const)
      for (const theme of ["light", "dark"] as const)
        test(`homepage imagery: ${viewport.name} ${locale} ${theme}`, async ({
          page,
        }, testInfo) => {
          test.setTimeout(90_000);
          const consoleErrors: string[] = [];
          page.on("pageerror", (error) =>
            consoleErrors.push(`pageerror: ${error.message}`),
          );
          page.on("console", (message) => {
            if (message.type() === "error") {
              const text = message.text();
              // A 404 on the document itself is not an application error.
              if (/Failed to load resource/.test(text)) return;
              /*
               * Nor is Firefox's cookie-policy notice for `__cf_bm`.
               *
               * Supabase storage sits behind Cloudflare, which sets that
               * bot-management cookie on the image response. Firefox rejects
               * it as a third-party cookie for that domain and reports the
               * rejection as a console *error*; Chromium says nothing. It is
               * a cookie we do not set, cannot control, and which has no
               * effect on the page — the images it is attached to decode
               * fine, which the naturalWidth assertions above already prove.
               *
               * Deliberately matched narrowly on that one cookie name so a
               * genuine cross-origin or CSP error still fails this test.
               */
              if (/Cookie .*__cf_bm.* has been rejected/.test(text)) return;
              consoleErrors.push(`console: ${text}`);
            }
          });

          await page.setViewportSize(viewport);
          await visitInTheme(page, locale === "ar" ? "/ar" : "/", theme);
          await scrollThrough(page);

          const states = await readReveals(page);
          const label = `${viewport.name}-${locale}-${theme}-${testInfo.project.name}`;
          expect(states.length, `${label}: no reveals found`).toBeGreaterThan(
            0,
          );
          expect(describeFailures(states, label)).toBe("");

          // Every revealed image must also have decoded to real content.
          for (const state of states) {
            expect(
              state.naturalWidth,
              `${label} reveal #${state.index} decoded nothing`,
            ).toBeGreaterThan(0);
            if (state.flat !== null)
              expect(
                state.flat,
                `${label} reveal #${state.index} is a flat colour, not an image`,
              ).toBe(false);
          }

          expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
        });

  test("every other page using the primitive reveals too", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    // The primitive is shared, so a fix that only worked on the homepage
    // would be a patch rather than a fix.
    for (const path of ["/about", "/contact", "/knowledge"]) {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(path);
      await scrollThrough(page);
      const states = await readReveals(page);
      expect(describeFailures(states, `${path} ${testInfo.project.name}`)).toBe(
        "",
      );
    }
  });

  test("reduced motion shows the image immediately and never clips it", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    await page.goto("/");

    // Before any scrolling: nothing may be hidden behind a wipe that will
    // never play, which is the failure mode reduced motion has to avoid.
    const atRest = await readReveals(page);
    expect(
      describeFailures(atRest, `reduced-motion ${testInfo.project.name}`),
    ).toBe("");

    await scrollThrough(page);
    const afterScroll = await readReveals(page);
    expect(
      describeFailures(
        afterScroll,
        `reduced-motion scrolled ${testInfo.project.name}`,
      ),
    ).toBe("");
    await context.close();
  });

  test("the wipe still animates when motion is allowed", async ({ page }) => {
    // The fix must not have turned the effect off: the clip has to start
    // closed and finish open.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    const closedAtStart = await page.evaluate(() => {
      const clips = [
        ...document.querySelectorAll('[data-motion="image-clip"]'),
      ];
      return clips.some((clip) =>
        /100%/.test(getComputedStyle(clip as HTMLElement).clipPath),
      );
    });
    expect(
      closedAtStart,
      "no reveal started closed — the wipe is not running at all",
    ).toBe(true);

    await scrollThrough(page);
    expect(describeFailures(await readReveals(page), "animation")).toBe("");
  });
});
