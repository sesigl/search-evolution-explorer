import type { VectorStore } from "../ports/vector-store.ts";
import { compareScoreThenId } from "../sort-score.ts";

export interface VectorHit {
  readonly itemId: string;
  readonly score: number;
}

export function vectorRetrieve(
  queryVector: Float32Array,
  store: VectorStore,
  limit: number,
): VectorHit[] {
  const hits: VectorHit[] = [];
  for (const itemId of store.itemIds()) {
    const documentVector = store.getVector(itemId);
    if (documentVector !== undefined) {
      hits.push({ itemId, score: cosineSimilarity(queryVector, documentVector) });
    }
  }
  hits.sort((left, right) =>
    compareScoreThenId([left.itemId, left.score], [right.itemId, right.score]),
  );
  return hits.slice(0, limit);
}

export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return total;
}
