import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "./reciprocal-rank-fusion.ts";

describe("reciprocal rank fusion", () => {
  it("Given two rankings, When they are fused, Then fusion uses ranks not raw scores and the hand-computed order is returned", () => {
    // A: a=1, b=2. B: a=1, c=2. k=60.
    // a: 1/61 + 1/61, b: 1/62, c: 1/62. a first; b before c by id.
    expect(
      reciprocalRankFusion(
        [
          ["a", "b"],
          ["a", "c"],
        ],
        60,
      ).map((row) => row.itemId),
    ).toEqual(["a", "b", "c"]);
  });

  it("Given identical ranks for two items, When they are fused, Then the lower id wins the tie", () => {
    expect(reciprocalRankFusion([["b"], ["a"]], 60).map((row) => row.itemId)).toEqual(["a", "b"]);
  });
});
