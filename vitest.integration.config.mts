import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Live-staging integration suite. Kept separate from the default hermetic
// `npm test` run because these tests require real Supabase credentials and
// create/delete ephemeral fixture accounts. See tests/integration/README.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
