import type { CorpusItem } from "../types/corpus.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import type { RetrievalSignal } from "../types/ranking.ts";

export function buildSignals(
  understanding: QueryUnderstanding,
  item: CorpusItem,
  parts: readonly { name: string; value: number; weight?: number | undefined }[],
): readonly RetrievalSignal[] {
  return parts.map((part) => ({
    name: part.name,
    value: part.value,
    weight: part.weight,
    explanation: `${part.name} of "${item.title}" for the query "${understanding.rawText}" is ${part.value.toFixed(3)}`,
  }));
}
