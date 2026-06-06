import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Tests exercise the built dist; v8 + source maps report against src.
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
