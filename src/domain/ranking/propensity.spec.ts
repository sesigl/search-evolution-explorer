import { describe, expect, it } from "vitest";
import { positionDecay } from "../simulation/position-decay.ts";
import type { SimulatedSession } from "../simulation/session-sampler.ts";
import { estimatePropensity, inversePropensity } from "./propensity.ts";

describe("propensity estimation", () => {
  it("Given a log sampled from a known decay, When propensity is estimated, Then the estimated decay approaches the true decay", () => {
    const trueDecay = [positionDecay(1), positionDecay(2), positionDecay(3)];
    const sessions: SimulatedSession[] = [];
    for (let index = 0; index < 2000; index += 1) {
      const shownItemIds = ["a", "b", "c"];
      const clickedItemIds: string[] = [];
      if (index % 1 === 0) {
        clickedItemIds.push("a");
      }
      if (index % 2 === 0) {
        clickedItemIds.push("b");
      }
      if (index % 3 === 0) {
        clickedItemIds.push("c");
      }
      sessions.push({
        sessionId: `s-${index}`,
        queryText: "q",
        shownItemIds,
        clickedItemIds,
      });
    }
    const model = estimatePropensity(sessions, 3);
    expect(model.trueDecay).toEqual(trueDecay);
    expect(model.estimatedDecay[0]).toBeCloseTo(1, 5);
    expect(model.estimatedDecay[1]).toBeCloseTo(0.5, 5);
    expect(model.estimatedDecay[2]).toBeCloseTo(1 / 3, 2);
  });

  it("Given every shown item is clicked, When propensity is estimated, Then the estimate is 1 at every rank and ignores items past max rank", () => {
    const sessions: SimulatedSession[] = Array.from({ length: 10 }, (_, index) => ({
      sessionId: `s-${index}`,
      queryText: "q",
      shownItemIds: ["a", "b", "c", "ignored"],
      clickedItemIds: ["a", "b", "c", "ignored"],
    }));
    const model = estimatePropensity(sessions, 3);
    expect(model.estimatedDecay).toEqual([1, 1, 1]);
    expect(model.trueDecay).toEqual([positionDecay(1), positionDecay(2), positionDecay(3)]);
  });

  it("Given no impressions, When propensity is estimated, Then the estimate falls back to the true 1/rank decay", () => {
    const model = estimatePropensity([], 2);
    expect(model.estimatedDecay).toEqual([positionDecay(1), positionDecay(2)]);
    expect(model.trueDecay).toEqual([positionDecay(1), positionDecay(2)]);
  });

  it("Given a known examination probability, When inverse propensity is computed, Then the weight is one over that probability", () => {
    expect(inversePropensity([1, 0.5], 2)).toBe(2);
  });

  it("Given a very small examination probability, When inverse propensity is computed, Then the weight is clipped", () => {
    expect(inversePropensity([0.01], 1)).toBe(8);
  });

  it("Given a rank with no estimate, When inverse propensity is computed, Then the minimum propensity of 0.05 is used", () => {
    expect(inversePropensity([1], 9)).toBe(8);
  });
});
