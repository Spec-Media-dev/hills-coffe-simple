import { defineConfig, devices } from "@playwright/test";

/**
 * DEVELOPMENT-server Playwright config.
 *
 * The default `playwright.config.ts` runs `npm run start`. React's
 * "Encountered a script tag while rendering React component" message — and
 * every other React development warning — is stripped from production builds,
 * so a production server can never emit it. Phase 2's suite passed 134/134
 * against `npm run start` while that defect was still live in `npm run dev`.
 *
 * This config closes that blind spot by serving the app with `npm run dev`.
 * It runs only the specs whose assertions depend on development diagnostics,
 * so the production suite stays the fast default.
 *
 * Run with: npm run test:e2e:dev
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["dev-runtime.spec.ts", "locale-switch.spec.ts"],
  // A dev server compiles routes on first visit, so latency is variable and
  // higher than production. The timeout is generous and one retry absorbs
  // compile flakes; a genuine defect still fails both attempts.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/robots.txt",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "dev", use: { ...devices["Desktop Chrome"] } }],
});
