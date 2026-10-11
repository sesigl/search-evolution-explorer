export function recallAt(
  rankedIds: readonly string[],
  relevantIds: ReadonlySet<string>,
  k: number,
): number {
  if (relevantIds.size === 0) {
    return 0;
  }
  const retrieved = rankedIds.slice(0, k);
  let hits = 0;
  for (const itemId of retrieved) {
    if (relevantIds.has(itemId)) {
      hits += 1;
    }
  }
  return hits / relevantIds.size;
}
