import { describe, expect, it } from "vitest";
import { understand } from "../query-understanding/understand.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { combineTowerScores } from "./combine-scores.ts";

describe("validated score fusion", () => {
  const item: CorpusItem = {
    id: "phone",
    title: "Phone",
    description: "",
    categoryId: "electronics",
    priceCents: 100,
    location: "Berlin",
    postedAt: "2026-09-01",
    available: true,
  };
  const understanding = understand(
    "phone",
    { stopWords: [], synonymGroups: [], variantRules: [] },
    {},
    [],
  );
  it("Given joint relevance and an independent retrieval score, When combined, Then the displayed weighted terms reconstruct the final score", () => {
    const result = combineTowerScores(
      understanding,
      { item, score: -2, signals: [{ name: "crossEncoder", value: -2, explanation: "joint" }] },
      new Float32Array([1, 0]),
      {
        queryWeights: [
          [1, 0],
          [0, 1],
        ],
        scoreWeight: 4,
        retrievalLimit: 25,
        itemVectors: {
          itemIds: () => [item.id],
          dimensions: () => 2,
          getVector: () => new Float32Array([0.6, 0.8]),
        },
      },
    );
    expect(result.score).toBeCloseTo(0.4);
    expect(result.signals.map(({ name, weight }) => ({ name, weight }))).toEqual([
      { name: "crossEncoder", weight: 1 },
      { name: "twoTowerSimilarity", weight: 4 },
    ]);
    expect(
      result.signals.reduce((sum, signal) => sum + signal.value * (signal.weight ?? 0), 0),
    ).toBe(result.score);
  });
  it("Given an incomplete trained index, When a candidate is scored, Then serving fails instead of inventing a similarity", () => {
    expect(() =>
      combineTowerScores(understanding, { item, score: 1, signals: [] }, new Float32Array([1]), {
        queryWeights: [[1]],
        scoreWeight: 1,
        retrievalLimit: 25,
        itemVectors: { itemIds: () => [], dimensions: () => 1, getVector: () => undefined },
      }),
    ).toThrow("missing from the trained item index");
  });
});
