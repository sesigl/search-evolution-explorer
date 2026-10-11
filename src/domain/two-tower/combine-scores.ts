import { buildSignals } from "../signals/build-signals.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import type { ScoredCandidate } from "../types/ranking.ts";
import { cosineSimilarity } from "../vector/vector-retrieval.ts";
import type { TwoTowerRetrieval } from "./model.ts";

/** Validation chooses one global weight; every query uses the same score formula. */
export function combineTowerScores(
  understanding: QueryUnderstanding,
  baseline: ScoredCandidate,
  queryVector: Float32Array,
  model: TwoTowerRetrieval,
): ScoredCandidate {
  const itemVector = model.itemVectors.getVector(baseline.item.id);
  if (itemVector === undefined) {
    throw new Error("Candidate is missing from the trained item index.");
  }
  const similarity = cosineSimilarity(queryVector, itemVector);
  return {
    item: baseline.item,
    score: baseline.score + model.scoreWeight * similarity,
    signals: [
      ...baseline.signals.filter((signal) => signal.name !== "crossEncoder"),
      ...buildSignals(understanding, baseline.item, [
        { name: "crossEncoder", value: baseline.score, weight: 1 },
        { name: "twoTowerSimilarity", value: similarity, weight: model.scoreWeight },
      ]),
    ],
  };
}
