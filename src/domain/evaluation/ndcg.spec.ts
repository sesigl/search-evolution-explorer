import { describe, expect, it } from "vitest";
import { ndcgAt } from "./ndcg.ts";

describe("NDCG", () => {
  it("Given an ideal ranking of graded items, When NDCG@10 is computed, Then the value is 1", () => {
    const grades = new Map([
      ["c", 1],
      ["b", 2],
      ["a", 3],
    ]);
    expect(ndcgAt(["a", "b", "c"], grades, 10)).toBe(1);
  });

  it("Given a reversed ranking of the same grades, When NDCG@10 is computed, Then the value matches the hand-computed ratio", () => {
    const grades = new Map([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);
    // DCG_rev = 1/log2(2) + 3/log2(3) + 7/log2(4) = 1 + 1.892789260714372 + 3.5
    // IDCG     = 7/log2(2) + 3/log2(3) + 1/log2(4) = 7 + 1.892789260714372 + 0.5
    expect(ndcgAt(["c", "b", "a"], grades, 10)).toBeCloseTo(0.680_606, 5);
  });

  it("Given no relevant items, When NDCG@10 is computed, Then the value is 0", () => {
    expect(ndcgAt(["a"], new Map([["a", 0]]), 10)).toBe(0);
    expect(ndcgAt([], new Map(), 10)).toBe(0);
  });

  it("Given a relevant item at position 2 only, When NDCG@10 is computed, Then the value is 1/log2(3)", () => {
    expect(ndcgAt(["x", "a"], new Map([["a", 1]]), 10)).toBeCloseTo(1 / Math.log2(3), 6);
  });

  it("Given a grade-3 item at rank 10, When NDCG@10 is computed, Then rank 11 does not change the value and rank 9 would drop it", () => {
    const ranked = Array.from({ length: 11 }, (_, index) => `item-${index}`);
    const grades = new Map([["item-9", 3]]);
    expect(ndcgAt(ranked, grades, 10)).toBeCloseTo(1 / Math.log2(11), 8);
    expect(ndcgAt(ranked, grades, 9)).toBe(0);
  });
});
