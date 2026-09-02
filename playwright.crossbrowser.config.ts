import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-engine config for the public rendering surface.
 *
 * The default config runs Chromium only, which is how an engine-specific
 * rendering fault reached the owner's browser without a test noticing: the
 * `ImageReveal` wipe deadlocked in Chromium and worked in Firefox, so there
 * was nothing to compare against. These specs are the ones whose subject is
 * rendering rather than behaviour, so they earn a second engine.
 *
 * Deliberately not included: `accessibility.spec.ts`. Firefox aborts roughly
 * one navigation in six there with `NS_ERROR_ABORT`, on routes that load
 * correctly when visited on their own (verified: 200, correct heading, no page
 * errors). That is a Playwright/Firefox navigation behaviour on the
 * unprefixed English routes, not a rendering fault, and the axe rules it
 * checks are engine-independent and already run under the default config.
 * Worth revisiting if Firefox coverage is ever wanted there.
 *
 * Run with: npx playwright test --config=playwright.crossbrowser.config.ts
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "image-reveal.spec.ts",
    "public-smoke.spec.ts",
    "phase9-public-design.spec.ts",
    "theme-locale.spec.ts",
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000/robots.txt",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
