import { describe, expect, it } from "vitest";
import { trainPairwise } from "./pairwise-trainer.ts";

const prior = { weights: [1], bias: 0 };
const config = { seed: 1, epochs: 1, learningRate: 0.5 };

describe("pairwise trainer", () => {
  it("Given a correctly ordered pair, When one epoch trains, Then the weight correction is smaller than for a reversed pair", () => {
    const correct = trainPairwise([{ better: [2], worse: [1], weight: 1 }], prior, config);
    const reversed = trainPairwise([{ better: [1], worse: [2], weight: 1 }], prior, config);
    const correctDelta = Math.abs((correct.weights[0] ?? 0) - 1);
    const reversedDelta = Math.abs((reversed.weights[0] ?? 0) - 1);
    expect(reversedDelta).toBeGreaterThan(correctDelta);
  });

  it("Given a seed, When training runs twice, Then the weights are identical", () => {
    const examples = [
      { better: [1, 0], worse: [0, 1], weight: 1 },
      { better: [0.8, 0.1], worse: [0.2, 0.9], weight: 0.5 },
    ];
    const initial = { weights: [0, 0], bias: 0 };
    const twice = { seed: 42, epochs: 3, learningRate: 0.1 };
    expect(trainPairwise(examples, initial, twice)).toEqual(
      trainPairwise(examples, initial, twice),
    );
  });

  it("Given one correctly ordered pair, When one epoch trains, Then the weight and bias match the RankNet update", () => {
    const trained = trainPairwise([{ better: [3], worse: [1], weight: 1 }], prior, config);
    const probability = 1 / (1 + Math.exp(-2));
    const error = 1 - probability;
    expect(trained.weights[0]).toBeCloseTo(1 + 0.5 * error * 2, 10);
    expect(trained.bias).toBeCloseTo(0.5 * error, 10);
  });

  it("Given two pairs and a seed, When three epochs train, Then the shuffled updates match the recorded weights", () => {
    const trained = trainPairwise(
      [
        { better: [1, 0], worse: [0, 1], weight: 1 },
        { better: [0.8, 0.1], worse: [0.2, 0.9], weight: 0.5 },
      ],
      { weights: [0, 0], bias: 0 },
      { seed: 42, epochs: 3, learningRate: 0.1 },
    );
    expect(trained.weights[0]).toBeCloseTo(0.181_358_780_643_597_9, 10);
    expect(trained.weights[1]).toBeCloseTo(-0.195_356_985_969_001_47, 10);
    expect(trained.bias).toBeCloseTo(0.209_355_191_294_405_05, 10);
  });

  it("Given zero epochs, When training runs, Then the weights are unchanged", () => {
    expect(
      trainPairwise([{ better: [2], worse: [1], weight: 1 }], prior, {
        seed: 1,
        epochs: 0,
        learningRate: 0.5,
      }),
    ).toEqual(prior);
  });
});
