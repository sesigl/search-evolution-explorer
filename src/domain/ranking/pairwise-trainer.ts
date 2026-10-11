import { createRng } from "../simulation/rng.ts";
import { linearCombination } from "./linear-scorer.ts";

export interface PairwiseExample {
  readonly better: readonly number[];
  readonly worse: readonly number[];
  readonly weight: number;
}

export interface TrainerConfig {
  readonly seed: number;
  readonly epochs: number;
  readonly learningRate: number;
}

export interface TrainedWeights {
  readonly weights: readonly number[];
  readonly bias: number;
}

export function trainPairwise(
  examples: readonly PairwiseExample[],
  initial: TrainedWeights,
  config: TrainerConfig,
): TrainedWeights {
  const weights = [...initial.weights];
  let bias = initial.bias;
  const rng = createRng(config.seed);
  for (let epoch = 0; epoch < config.epochs; epoch += 1) {
    const order = shuffledIndexes(examples.length, rng);
    for (const exampleIndex of order) {
      const example = examples[exampleIndex];
      if (example !== undefined) {
        const delta =
          linearCombination(weights, bias, example.better) -
          linearCombination(weights, bias, example.worse);
        const probability = 1 / (1 + Math.exp(-delta));
        const error = example.weight * (1 - probability);
        for (const [index, weight] of weights.entries()) {
          const betterValue = example.better[index] ?? 0;
          const worseValue = example.worse[index] ?? 0;
          weights[index] = weight + config.learningRate * error * (betterValue - worseValue);
        }
        bias += config.learningRate * error;
      }
    }
  }
  return { weights, bias };
}

function shuffledIndexes(length: number, rng: () => number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1));
    const current = order[index] ?? 0;
    const other = order[swapWith] ?? 0;
    order[index] = other;
    order[swapWith] = current;
  }
  return order;
}
