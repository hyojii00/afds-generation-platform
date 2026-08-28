import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@afds-generation-platform/generation": fileURLToPath(
        new URL("./packages/generation/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.spec.ts"],
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
