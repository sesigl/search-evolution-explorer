import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

/**
 * Stryker config for the test run only. It shares every setting with `vitest.config.ts` except
 * one exclusion: `src/content/code-notes.spec.ts` reads the domain modules as text and asserts
 * that each authored note still anchors to exactly one line. Mutation testing instruments those
 * modules, so an instrumented line can never match its authored anchor. The check is unchanged
 * in `npm test` (part of `npm run verify`); mutation skips that one source-text spec.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "src/content/code-notes.spec.ts"],
    },
  }),
);
