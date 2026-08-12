import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./test/obsidian.ts", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    coverage: {
      include: [
        "src/core/dateUtils.ts",
        "src/core/pathDefaults.ts",
        "src/data/**/*.ts",
        "src/tasks/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 95,
        lines: 90,
        statements: 90,
      },
    },
    restoreMocks: true,
  },
});
