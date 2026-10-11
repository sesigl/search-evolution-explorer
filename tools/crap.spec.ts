import { describe, expect, it } from "vitest";
import { CRAP_THRESHOLD, computeCrap, isAboveCrapThreshold } from "./crap-score.ts";

const fullyCovered = 1;
const uncovered = 0;
const complexityOnThreshold = 5;
const complexityAboveThreshold = 6;
const crapAboveThreshold = 42;
const wellCoveredComplexity = 10;

describe("CRAP score", () => {
  it("Given complexity 1 and full coverage, When CRAP is computed, Then the score equals complexity", () => {
    expect(computeCrap(1, fullyCovered)).toBe(1);
  });

  it("Given complexity 5 and zero coverage, When CRAP is computed, Then the score sits on the threshold", () => {
    expect(computeCrap(complexityOnThreshold, uncovered)).toBe(CRAP_THRESHOLD);
    expect(isAboveCrapThreshold(CRAP_THRESHOLD)).toBe(false);
  });

  it("Given complexity 6 and zero coverage, When CRAP is computed, Then the score exceeds the threshold", () => {
    expect(computeCrap(complexityAboveThreshold, uncovered)).toBe(crapAboveThreshold);
    expect(isAboveCrapThreshold(crapAboveThreshold)).toBe(true);
  });

  it("Given complexity 10 and full coverage, When CRAP is computed, Then coverage cancels the quadratic term", () => {
    expect(computeCrap(wellCoveredComplexity, fullyCovered)).toBe(wellCoveredComplexity);
    expect(isAboveCrapThreshold(wellCoveredComplexity)).toBe(false);
  });
});
