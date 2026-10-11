import { itemText } from "../text/item-text.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { Analyzer } from "../types/level.ts";

const K1 = 1.2;
const B = 0.75;

export function bm25Score(
  queryTokens: readonly string[],
  item: CorpusItem,
  documentCount: number,
  averageLength: number,
  documentFrequency: ReadonlyMap<string, number>,
  analyze: Analyzer,
): number {
  const tokens = analyze(itemText(item));
  const length = Math.max(tokens.length, 1);
  const termFrequency = new Map<string, number>();
  for (const token of tokens) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  }
  let score = 0;
  for (const term of queryTokens) {
    const tf = termFrequency.get(term) ?? 0;
    if (tf > 0) {
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));
      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * (length / averageLength));
      score += idf * (numerator / denominator);
    }
  }
  return score;
}

export function documentFrequencyOf(
  items: readonly CorpusItem[],
  analyze: Analyzer,
): {
  documentCount: number;
  averageLength: number;
  documentFrequency: Map<string, number>;
} {
  const available = items.filter((item) => item.available);
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;
  for (const item of available) {
    const tokens = analyze(itemText(item));
    totalLength += tokens.length;
    const unique = new Set(tokens);
    for (const token of unique) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const documentCount = available.length;
  const averageLength = documentCount === 0 ? 1 : totalLength / documentCount;
  return { documentCount, averageLength, documentFrequency };
}
