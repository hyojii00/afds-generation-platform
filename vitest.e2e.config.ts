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
    include: ["apps/**/*.e2e-spec.ts"],
    environment: "node",
  },
});
