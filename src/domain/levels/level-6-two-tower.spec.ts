import { describe, expect, it, vi } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { CrossEncoder } from "../ports/cross-encoder.ts";
import { understand } from "../query-understanding/understand.ts";
import { runSearch } from "../search/run-search.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { createRanker, meta } from "./level-6-two-tower.ts";

const levers = { stopWords: [], synonymGroups: [], variantRules: [] };
const clock = { now: () => new Date("2026-09-09") };
const items: CorpusItem[] = Array.from({ length: 55 }, (_, i) => ({
  id: `lamp-${String(i).padStart(2, "0")}`,
  title: "lamp",
  description: `listing ${i}`,
  categoryId: "furniture",
  priceCents: 1000,
  location: "Berlin",
  postedAt: "2026-09-01",
  available: true,
}));

function dependencies(
  scorePairs: CrossEncoder["scorePairs"],
  retrieved: string[],
): Parameters<typeof createRanker>[0] {
  return {
    corpus: { readItems: async () => items, readCategories: async () => [] },
    index: buildInvertedIndex(items, (text) => text.split(" ")),
    levers,
    clock,
    crossEncoder: { scorePairs },
    twoTower: {
      queryWeights: [[1]],
      scoreWeight: 0,
      retrievalLimit: 50,
      itemVectors: {
        itemIds: () => retrieved,
        dimensions: () => 1,
        getVector: () => new Float32Array([1]),
      },
    },
  };
}

describe("trained retrieval after chapter 8", () => {
  it("Given a relevant listing outside the previous shortlist, When learned retrieval finds it, Then it enters and is jointly ranked before pagination", async () => {
    const scorePairs = vi.fn(async (_query: string, documents: readonly string[]) =>
      documents.map((text) => (text.endsWith("54") ? 9 : -2)),
    );
    const ranker = createRanker(dependencies(scorePairs, ["lamp-54", "lamp-00", "deleted"]));
    const deps = {
      levels: [meta],
      rankers: new Map([[meta.id, ranker]]),
      levers,
      clock,
      categories: [],
    };
    const output = await runSearch(
      { queryText: "lamp", levelId: meta.id, queryVector: new Float32Array([1]) },
      deps,
    );
    expect(output.candidateWidth).toBe(51);
    expect(output.results[0]).toMatchObject({ item: { id: "lamp-54" }, score: 9, position: 1 });
    expect(output.results[0]?.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "twoTowerSimilarity", value: 1 }),
        expect.objectContaining({ name: "learnedRetrievalOnly", value: 1 }),
      ]),
    );
    expect(scorePairs.mock.calls.map((call) => call[1].length)).toEqual([50, 1]);
    const page = await runSearch(
      {
        queryText: "lamp",
        levelId: meta.id,
        queryVector: new Float32Array([1]),
        offset: 1,
        limit: 1,
      },
      deps,
    );
    expect(page.results[0]?.item.id).toBe(output.results[1]?.item.id);
  });

  it("Given no new neighbours, When searched, Then only the original joint inference runs", async () => {
    const scorePairs = vi.fn(async (_query: string, documents: readonly string[]) =>
      documents.map(() => 2),
    );
    const ranker = createRanker(dependencies(scorePairs, ["lamp-00"]));
    const query = { ...understand("lamp", levers, {}, []), queryVector: new Float32Array([1]) };
    const result = await ranker.match(query);
    expect(result.items).toHaveLength(50);
    expect(scorePairs).toHaveBeenCalledTimes(1);
    expect(ranker.score(query, result.items[0] as CorpusItem).score).toBe(2);
    expect(() =>
      ranker.score(understand("another", levers, {}, []), result.items[0] as CorpusItem),
    ).toThrow("awaited match");
    await expect(ranker.match(understand("lamp", levers, {}, []))).rejects.toThrow(
      "frozen query embedding",
    );
  });

  it.each([{ scores: [] }, { scores: [Number.NaN] }])(
    "Given invalid additional joint scores, When retrieved, Then no fabricated score is returned",
    async ({ scores }) => {
      const scorePairs = vi
        .fn()
        .mockResolvedValueOnce(new Array(50).fill(1))
        .mockResolvedValueOnce(scores);
      const ranker = createRanker(dependencies(scorePairs, ["lamp-54"]));
      await expect(
        ranker.match({ ...understand("lamp", levers, {}, []), queryVector: new Float32Array([1]) }),
      ).rejects.toThrow("one finite cross-encoder score");
    },
  );
});
