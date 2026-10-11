import { describe, expect, it } from "vitest";
import { ndcgAt } from "../evaluation/ndcg.ts";
import { linearScore } from "./linear-scorer.ts";
import { trainPairwise } from "./pairwise-trainer.ts";

describe("bias correction", () => {
  it("Given clicks that over-weight the top log position, When pairs are reweighted by inverse propensity, Then the corrected variant beats the naive variant on unbiased grades", () => {
    const bait = [1, 0];
    const relevant = [0, 1];
    const naiveExamples = [
      ...Array.from({ length: 80 }, () => ({ better: bait, worse: relevant, weight: 1 })),
      ...Array.from({ length: 20 }, () => ({ better: relevant, worse: bait, weight: 1 })),
    ];
    const correctedExamples = [
      ...Array.from({ length: 80 }, () => ({ better: bait, worse: relevant, weight: 1 })),
      ...Array.from({ length: 20 }, () => ({ better: relevant, worse: bait, weight: 8 })),
    ];
    const initial = { weights: [0, 0], bias: 0 };
    const config = { seed: 3, epochs: 6, learningRate: 0.2 };
    const naive = trainPairwise(naiveExamples, initial, config);
    const corrected = trainPairwise(correctedExamples, initial, config);
    const grades = new Map([
      ["relevant", 3],
      ["bait", 0],
    ]);
    const naiveNdcg = ndcgAt(rankIds(naive, bait, relevant), grades, 10);
    const correctedNdcg = ndcgAt(rankIds(corrected, bait, relevant), grades, 10);
    expect(correctedNdcg).toBeGreaterThan(naiveNdcg);
  });
});

function rankIds(
  model: { weights: readonly number[]; bias: number },
  bait: readonly number[],
  relevant: readonly number[],
): string[] {
  const trained = {
    variant: "naive" as const,
    featureNames: ["recency", "overlap"],
    weights: model.weights,
    bias: model.bias,
  };
  const scored = [
    { id: "bait", score: linearScore(trained, bait) },
    { id: "relevant", score: linearScore(trained, relevant) },
  ];
  scored.sort((left, right) => right.score - left.score);
  return scored.map((entry) => entry.id);
}
