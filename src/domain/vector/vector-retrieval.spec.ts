import { describe, expect, it } from "vitest";
import type { VectorStore } from "../ports/vector-store.ts";
import { vectorRetrieve } from "./vector-retrieval.ts";

function storeFrom(entries: readonly [string, number[]][]): VectorStore {
  const vectors = new Map(entries.map(([id, values]) => [id, Float32Array.from(values)]));
  return {
    getVector(itemId) {
      return vectors.get(itemId);
    },
    itemIds() {
      return [...vectors.keys()];
    },
    dimensions() {
      return 2;
    },
  };
}

describe("vector retrieval", () => {
  it("Given precomputed document vectors, When a query vector is compared, Then only the query is used per request and the nearest document ranks first", () => {
    const store = storeFrom([
      ["far", [1, 0]],
      ["near", [0, 1]],
    ]);
    const hits = vectorRetrieve(Float32Array.from([0, 1]), store, 2);
    expect(hits.map((hit) => hit.itemId)).toEqual(["near", "far"]);
    expect(hits[0]?.score).toBe(1);
  });
});
