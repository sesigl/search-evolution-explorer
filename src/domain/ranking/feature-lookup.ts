import type { Clock } from "../ports/clock.ts";
import { understand } from "../query-understanding/understand.ts";
import { freezeClock } from "../signals/frozen-clock.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { InvertedIndex } from "../types/level.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { extractFeatures } from "./features.ts";

export function createFeatureLookup(
  items: readonly CorpusItem[],
  index: InvertedIndex,
  levers: LeverConfiguration,
  clock: Clock,
): (queryText: string, itemId: string) => number[] | undefined {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const featureCache = new Map<string, number[]>();
  const understandingCache = new Map<string, ReturnType<typeof understand>>();
  // Recency reads the clock per candidate. Freeze it once, or two listings posted at the
  // same moment get different feature vectors depending on the order they were scored.
  const frozen = freezeClock(clock);
  return (queryText, itemId) => {
    const key = `${queryText}\0${itemId}`;
    const cached = featureCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const item = itemsById.get(itemId);
    if (item === undefined) {
      return;
    }
    let understanding = understandingCache.get(queryText);
    if (understanding === undefined) {
      understanding = understand(queryText, levers, {}, []);
      understandingCache.set(queryText, understanding);
    }
    const features = extractFeatures(understanding, item, { index, levers, clock: frozen });
    featureCache.set(key, features);
    return features;
  };
}
