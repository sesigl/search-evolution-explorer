import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "tools/**/*.spec.ts", "scripts/**/*.spec.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json"],
      reportsDirectory: "coverage",
      // Actions are scored by tools/crap.ts, so their coverage must be measured here too.
      include: [
        "src/domain/**/*.ts",
        "src/adapters/**/*.ts",
        "src/actions/**/*.ts",
        "tools/crap-score.ts",
      ],
      exclude: ["**/*.spec.ts"],
      thresholds: {
        lines: 80,
        branches: 70,
        "src/domain/**": {
          lines: 95,
        },
      },
    },
  },
});
