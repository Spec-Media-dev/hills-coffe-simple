import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  // dev-runtime.spec.ts asserts React *development* diagnostics, which a
  // production server never emits. Running it here would pass vacuously and
  // imply coverage that does not exist. It runs via playwright.dev.config.ts
  // (`npm run test:e2e:dev`) instead.
  testIgnore: ["dev-runtime.spec.ts"],
  timeout: 30_000,
  expect: { timeout: 7_500 },
  // `auth-state-machine.spec.ts` drives real Supabase personas: it creates,
  // blocks and deletes actual accounts. Those fixtures are shared backend
  // state, so letting that file race other specs across workers produced
  // intermittent, non-reproducible failures in unrelated tests. A single
  // worker costs about a minute and makes the gate deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/robots.txt",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
