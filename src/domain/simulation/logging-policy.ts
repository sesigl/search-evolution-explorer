import type { CorpusItem } from "../types/corpus.ts";

export function shownInRecencyOrder(items: readonly CorpusItem[], limit: number): CorpusItem[] {
  return [...items]
    .filter((item) => item.available)
    .slice()
    .sort((left, right) => {
      const recency = Date.parse(right.postedAt) - Date.parse(left.postedAt);
      if (recency !== 0) {
        return recency;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}
