import type { SimulatedSession } from "../simulation/session-sampler.ts";
import type { PairwiseExample } from "./pairwise-trainer.ts";
import { inversePropensity } from "./propensity.ts";

/** Cap so a long result list does not explode the training set. */
const NEGATIVES_PER_CLICK = 16;
const TOP_NEGATIVES = 8;
/** IPS is too noisy below this rank on a long page. Naive still sees the click. */
const MAX_CORRECTED_CLICK_RANK = 20;

export function pairsFromLog(
  sessions: readonly SimulatedSession[],
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
  estimatedDecay: readonly number[],
): { naive: PairwiseExample[]; corrected: PairwiseExample[] } {
  const naive: PairwiseExample[] = [];
  const corrected: PairwiseExample[] = [];
  for (const session of sessions) {
    appendSessionPairs(session, featuresFor, estimatedDecay, naive, corrected);
  }
  return { naive, corrected };
}

function appendSessionPairs(
  session: SimulatedSession,
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
  estimatedDecay: readonly number[],
  naive: PairwiseExample[],
  corrected: PairwiseExample[],
): void {
  const clicked = new Set(session.clickedItemIds);
  for (const clickedId of session.clickedItemIds) {
    appendClickPairs(session, clickedId, clicked, featuresFor, estimatedDecay, naive, corrected);
  }
}

function appendClickPairs(
  session: SimulatedSession,
  clickedId: string,
  clicked: ReadonlySet<string>,
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
  estimatedDecay: readonly number[],
  naive: PairwiseExample[],
  corrected: PairwiseExample[],
): void {
  const better = featuresFor(session.queryText, clickedId);
  if (better === undefined) {
    return;
  }
  const clickRank = session.shownItemIds.indexOf(clickedId) + 1;
  const ips = inversePropensity(estimatedDecay, clickRank);
  const useIps = clickRank >= 1 && clickRank <= MAX_CORRECTED_CLICK_RANK;
  for (const shownId of negativesFor(session.shownItemIds, clicked, clickedId)) {
    const worse = featuresFor(session.queryText, shownId);
    if (worse !== undefined) {
      naive.push({ better, worse, weight: 1 });
      if (useIps) {
        corrected.push({ better, worse, weight: ips });
      }
    }
  }
}

function negativesFor(
  shownItemIds: readonly string[],
  clicked: ReadonlySet<string>,
  clickedId: string,
): string[] {
  const negatives = shownItemIds.filter((itemId) => !clicked.has(itemId));
  if (negatives.length <= NEGATIVES_PER_CLICK) {
    return negatives;
  }
  const head = negatives.slice(0, TOP_NEGATIVES);
  const rest = negatives.slice(TOP_NEGATIVES);
  const extra = hashedSample(rest, clickedId, NEGATIVES_PER_CLICK - head.length);
  return [...head, ...extra];
}

function hashedSample(ids: readonly string[], seed: string, count: number): string[] {
  const ranked = ids.map((id) => ({ id, key: hashKey(`${seed}:${id}`) }));
  ranked.sort((left, right) => {
    if (left.key !== right.key) {
      return left.key - right.key;
    }
    return left.id.localeCompare(right.id);
  });
  return ranked.slice(0, count).map((row) => row.id);
}

function hashKey(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 33 + char.charCodeAt(0)) % 2_147_483_647;
  }
  return hash;
}
