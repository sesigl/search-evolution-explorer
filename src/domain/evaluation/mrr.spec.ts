import { describe, expect, it } from "vitest";
import { mrr } from "./mrr.ts";

describe("MRR", () => {
  it("Given the first relevant item at position 1, When MRR is computed, Then the value is 1", () => {
    expect(mrr(["a", "b"], new Set(["a"]))).toBe(1);
  });

  it("Given the first relevant item at position 2, When MRR is computed, Then the value is 0.5", () => {
    expect(mrr(["x", "a"], new Set(["a"]))).toBe(0.5);
  });

  it("Given no relevant item in the ranking, When MRR is computed, Then the value is 0", () => {
    expect(mrr(["x"], new Set(["a"]))).toBe(0);
    expect(mrr([], new Set(["a"]))).toBe(0);
  });

  it("Given two relevant items, When MRR is computed, Then only the first relevant rank counts", () => {
    expect(mrr(["x", "a", "b"], new Set(["a", "b"]))).toBe(0.5);
  });
});
