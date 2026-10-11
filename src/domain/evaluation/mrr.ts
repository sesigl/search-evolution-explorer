export function mrr(rankedIds: readonly string[], relevantIds: ReadonlySet<string>): number {
  for (const [index, itemId] of rankedIds.entries()) {
    if (relevantIds.has(itemId)) {
      return 1 / (index + 1);
    }
  }
  return 0;
}
