import type { TrainedRankingModel } from "../types/level.ts";

export function linearCombination(
  weights: readonly number[],
  bias: number,
  features: readonly number[],
): number {
  let total = bias;
  for (const [index, weight] of weights.entries()) {
    total += weight * (features[index] ?? 0);
  }
  return total;
}

export function linearScore(model: TrainedRankingModel, features: readonly number[]): number {
  if (features.length !== model.weights.length) {
    throw new Error(
      `Feature length ${features.length} does not match weight length ${model.weights.length}.`,
    );
  }
  return linearCombination(model.weights, model.bias, features);
}
