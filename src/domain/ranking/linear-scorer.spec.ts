import { describe, expect, it } from "vitest";
import type { TrainedRankingModel } from "../types/level.ts";
import { linearCombination, linearScore } from "./linear-scorer.ts";

const model: TrainedRankingModel = {
  variant: "naive",
  featureNames: ["a", "b"],
  weights: [2, 3],
  bias: 1,
};

describe("linear scorer", () => {
  it("Given matching feature and weight lengths, When the score is computed, Then it is bias plus the dot product", () => {
    expect(linearScore(model, [4, 5])).toBe(1 + 8 + 15);
  });

  it("Given a shorter feature vector, When the score is computed, Then the call is rejected", () => {
    expect(() => linearScore(model, [4])).toThrow(
      "Feature length 1 does not match weight length 2.",
    );
  });

  it("Given a longer feature vector, When the score is computed, Then the call is rejected", () => {
    expect(() => linearScore(model, [4, 5, 6])).toThrow(
      "Feature length 3 does not match weight length 2.",
    );
  });

  it("Given a missing feature at an index, When a linear combination is computed, Then that feature counts as 0", () => {
    expect(linearCombination([2, 3], 1, [4])).toBe(1 + 8);
  });
});
