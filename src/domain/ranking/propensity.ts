import { positionDecay } from "../simulation/position-decay.ts";
import type { SimulatedSession } from "../simulation/session-sampler.ts";

export interface PropensityModel {
  readonly estimatedDecay: readonly number[];
  readonly trueDecay: readonly number[];
}

const MIN_PROPENSITY = 0.05;
const MAX_IPS = 8;

export function estimatePropensity(
  sessions: readonly SimulatedSession[],
  maxRank: number,
): PropensityModel {
  const impressions = Array.from({ length: maxRank }, () => 0);
  const clicks = Array.from({ length: maxRank }, () => 0);
  for (const session of sessions) {
    const clicked = new Set(session.clickedItemIds);
    for (const [offset, itemId] of session.shownItemIds.slice(0, maxRank).entries()) {
      impressions[offset] = (impressions[offset] ?? 0) + 1;
      if (clicked.has(itemId)) {
        clicks[offset] = (clicks[offset] ?? 0) + 1;
      }
    }
  }
  const estimatedDecay = impressions.map((impressionCount, offset) => {
    if (impressionCount === 0) {
      return positionDecay(offset + 1);
    }
    return (clicks[offset] ?? 0) / impressionCount;
  });
  const trueDecay = Array.from({ length: maxRank }, (_, offset) => positionDecay(offset + 1));
  return { estimatedDecay, trueDecay };
}

export function inversePropensity(estimatedDecay: readonly number[], rank: number): number {
  const probability = estimatedDecay[rank - 1] ?? MIN_PROPENSITY;
  return Math.min(1 / Math.max(probability, MIN_PROPENSITY), MAX_IPS);
}
