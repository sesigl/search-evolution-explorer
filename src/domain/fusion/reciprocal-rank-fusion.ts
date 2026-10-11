import { compareScoreThenId } from "../sort-score.ts";

export interface FusedRank {
  readonly itemId: string;
  readonly score: number;
}

export function reciprocalRankFusion(
  rankings: readonly (readonly string[])[],
  k: number,
): FusedRank[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    for (const [offset, itemId] of ranking.entries()) {
      scores.set(itemId, (scores.get(itemId) ?? 0) + 1 / (k + offset + 1));
    }
  }
  return [...scores.entries()]
    .sort(compareScoreThenId)
    .map(([itemId, score]) => ({ itemId, score }));
}
