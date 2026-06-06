import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Tests exercise the built dist; v8 + source maps report against src.
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      // Safety net: fail CI if coverage regresses. Set below the current 100%
      // so a hard-to-reach defensive branch doesn't force contrived tests.
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
