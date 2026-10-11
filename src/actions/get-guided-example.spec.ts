import { describe, expect, it } from "vitest";
import { levels } from "../domain/levels/level-registry.ts";
import { UseCaseError } from "../domain/search/errors.ts";
import { handleGetGuidedExample } from "./get-guided-example.ts";

describe("getGuidedExample action contract", () => {
  it("Given every implemented level above ordinal 0, When examples are listed, Then each level returns at least one example", () => {
    const implemented = levels.filter((level) => level.implemented && level.ordinal > 0);
    for (const level of implemented) {
      expect(level.guidedExamples.length).toBeGreaterThan(0);
    }
  });

  it("Given an unknown level, When a guided example is requested, Then the request is rejected", () => {
    expect(() => handleGetGuidedExample({ levelId: "level-99" })).toThrow(UseCaseError);
  });

  it("Given chapter 7, When a guided example is requested, Then it is compared with the previous chapter", () => {
    const output = handleGetGuidedExample({ levelId: "level-2-boosting" });
    expect(output.examples[0]?.comparedWithLevelId).toBe("level-1-canonical");
  });
});
