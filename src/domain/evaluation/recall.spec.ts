import { describe, expect, it } from "vitest";
import { recallAt } from "./recall.ts";

describe("Recall", () => {
  it("Given both relevant items in the top 50, When Recall@50 is computed, Then the value is 1", () => {
    expect(recallAt(["a", "b", "x"], new Set(["a", "b"]), 50)).toBe(1);
  });

  it("Given one of two relevant items in the top 50, When Recall@50 is computed, Then the value is 0.5", () => {
    expect(recallAt(["a", "x"], new Set(["a", "b"]), 50)).toBe(0.5);
  });

  it("Given no relevant items in the judgment set, When Recall@50 is computed, Then the value is 0", () => {
    expect(recallAt(["a"], new Set(), 50)).toBe(0);
  });

  it("Given the only relevant item at rank 50, When Recall@50 is computed, Then the value is 1 and Recall@49 is 0", () => {
    const ranked = Array.from({ length: 50 }, (_, index) => `item-${index}`);
    const relevant = new Set(["item-49"]);
    expect(recallAt(ranked, relevant, 50)).toBe(1);
    expect(recallAt(ranked, relevant, 49)).toBe(0);
  });
});
