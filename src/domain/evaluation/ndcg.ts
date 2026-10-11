import { compareScoreThenId } from "../sort-score.ts";

export function ndcgAt(
  rankedIds: readonly string[],
  gradesByItemId: ReadonlyMap<string, number>,
  k: number,
): number {
  const dcg = discountedGain(rankedIds, gradesByItemId, k);
  const idealIds = [...gradesByItemId.entries()].sort(compareScoreThenId).map(([itemId]) => itemId);
  const idcg = discountedGain(idealIds, gradesByItemId, k);
  if (idcg === 0) {
    return 0;
  }
  return dcg / idcg;
}

function discountedGain(
  rankedIds: readonly string[],
  gradesByItemId: ReadonlyMap<string, number>,
  k: number,
): number {
  const limit = Math.min(k, rankedIds.length);
  let total = 0;
  for (let index = 0; index < limit; index += 1) {
    const itemId = rankedIds[index];
    if (itemId !== undefined) {
      const grade = gradesByItemId.get(itemId) ?? 0;
      total += (2 ** grade - 1) / Math.log2(index + 2);
    }
  }
  return total;
}
