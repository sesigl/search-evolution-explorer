import type { CorpusItem } from "../types/corpus.ts";
import type { QueryUnderstanding } from "../types/query.ts";

export function priceFitScore(understanding: QueryUnderstanding, item: CorpusItem): number {
  const constraint = understanding.priceConstraint;
  if (constraint === null) {
    return 0;
  }
  const maxCents = constraint.maxCents;
  const minCents = constraint.minCents;
  if (maxCents !== undefined && item.priceCents > maxCents) {
    return 0;
  }
  if (minCents !== undefined && item.priceCents < minCents) {
    return 0;
  }
  return 1;
}
