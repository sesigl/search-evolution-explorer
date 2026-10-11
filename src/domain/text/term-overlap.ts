export function termOverlap(
  queryTokens: readonly string[],
  itemTokens: ReadonlySet<string>,
): number {
  if (queryTokens.length === 0) {
    return 0;
  }
  let hits = 0;
  for (const token of queryTokens) {
    if (itemTokens.has(token)) {
      hits += 1;
    }
  }
  return hits / queryTokens.length;
}
