import type { CorpusItem } from "../types/corpus.ts";

export function itemText(item: CorpusItem): string {
  return `${item.title} ${item.description}`;
}
