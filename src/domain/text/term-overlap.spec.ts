import { describe, expect, it } from "vitest";
import { termOverlap } from "./term-overlap.ts";

describe("term overlap", () => {
  it("Given no query tokens, When overlap is computed, Then the value is 0", () => {
    expect(termOverlap([], new Set(["lamp"]))).toBe(0);
  });

  it("Given every query token in the item, When overlap is computed, Then the value is 1", () => {
    expect(termOverlap(["red", "lamp"], new Set(["red", "lamp", "shade"]))).toBe(1);
  });

  it("Given half the query tokens in the item, When overlap is computed, Then the value is 0.5", () => {
    expect(termOverlap(["red", "sofa"], new Set(["red", "lamp"]))).toBe(0.5);
  });
});
