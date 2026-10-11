import type { Category, CorpusItem } from "../types/corpus.ts";

export interface CorpusSource {
  readItems(): Promise<readonly CorpusItem[]>;
  readCategories(): Promise<readonly Category[]>;
}
