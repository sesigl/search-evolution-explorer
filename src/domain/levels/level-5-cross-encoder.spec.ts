import { describe, expect, it, vi } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import { understand } from "../query-understanding/understand.ts";
import { runSearch } from "../search/run-search.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { CrossEncoderDeps } from "../types/level.ts";
import { createRanker as createPrevious } from "./level-4-hybrid.ts";
import { createRanker, meta } from "./level-5-cross-encoder.ts";
import { listLevels } from "./list-levels.ts";

const levers = { stopWords: [], synonymGroups: [], variantRules: [] };
const clock = { now: () => new Date("2026-09-09") };
const items: CorpusItem[] = Array.from({ length: 55 }, (_, index) => ({
  id: `lamp-${String(index).padStart(2, "0")}`,
  title: "Lamp",
  description: `Listing ${index}`,
  categoryId: "furniture",
  priceCents: 1000,
  location: "Berlin",
  postedAt: "2026-09-01",
  available: true,
}));

function dependencies(
  scorePairs: CrossEncoderDeps["crossEncoder"]["scorePairs"],
): CrossEncoderDeps {
  return {
    corpus: { readItems: async () => items, readCategories: async () => [] },
    index: buildInvertedIndex(items, (text) => analyzeDocument(text, levers)),
    levers,
    clock,
    crossEncoder: { scorePairs },
  };
}

describe("cross-encoder reranking", () => {
  it.each(meta.prerequisites)(
    "reports the rebuild command when $artifactPath is stale",
    (prerequisite) => {
      const [listed] = listLevels([meta], (path) =>
        path === prerequisite.artifactPath ? "stale" : "ready",
      );
      expect(listed).toMatchObject({
        implemented: true,
        prerequisiteState: "stale",
        rebuildCommand: prerequisite.buildCommand,
      });
    },
  );

  it("requires a completed match before a candidate can be scored", () => {
    const deps = dependencies(async () => []);
    const ranker = createRanker(deps);
    expect(() => ranker.score(understand("lamp", levers, {}, []), items[0] as CorpusItem)).toThrow(
      "requires an awaited match",
    );
  });

  it("keeps concurrent query scores separate and preserves the same candidates", async () => {
    const scorePairs = vi
      .fn()
      .mockResolvedValueOnce(Array(50).fill(-1))
      .mockResolvedValueOnce(Array(50).fill(2));
    const ranker = createRanker(dependencies(scorePairs));
    const first = understand("lamp", levers, {}, []);
    const second = understand("lamp", levers, {}, []);
    const [a, b] = await Promise.all([ranker.match(first), ranker.match(second)]);
    expect(a.items).toEqual(b.items);
    expect(a.items).toHaveLength(50);
    expect(a.items.map((candidate) => ranker.score(first, candidate).score)).toEqual(
      Array(50).fill(-1),
    );
    expect(b.items.map((candidate) => ranker.score(second, candidate).score)).toEqual(
      Array(50).fill(2),
    );
  });

  it("rejects non-finite neural scores", async () => {
    const ranker = createRanker(dependencies(async () => Array(50).fill(Number.NaN)));
    await expect(ranker.match(understand("lamp", levers, {}, []))).rejects.toThrow(
      "all scores must be finite",
    );
  });
  it("reranks only the hybrid top 50 before pagination and exposes the actual joint score", async () => {
    const scorePairs = vi.fn(async (_query: string, documents: readonly string[]) =>
      documents.map((_, index) => index - 25),
    );
    const deps = dependencies(scorePairs);
    const ranker = createRanker(deps);
    const output = await runSearch(
      { queryText: "lamp", levelId: meta.id, limit: 2, offset: 1 },
      { levels: [meta], rankers: new Map([[meta.id, ranker]]), levers, clock, categories: [] },
    );
    const previous = createPrevious(deps);
    const baseline = previous
      .match(output.understanding)
      .items.map((item) => previous.score(output.understanding, item))
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
    expect(scorePairs).toHaveBeenCalledExactlyOnceWith(
      "lamp",
      baseline.slice(0, 50).map(({ item }) => `${item.title} ${item.description}`),
    );
    expect(output.candidateWidth).toBe(50);
    expect(output.results.map((row) => row.item.id)).toEqual([
      baseline[48]?.item.id,
      baseline[47]?.item.id,
    ]);
    expect(output.results[0]).toMatchObject({ position: 2, score: 23 });
    expect(output.results[0]?.signals.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: "crossEncoder", value: 23 },
      { name: "previousRank", value: 49 },
      { name: "rrf", value: baseline[48]?.score },
      { name: "vectorSimilarity", value: 0 },
    ]);
  });

  it("rejects incomplete neural output instead of presenting hybrid scores as chapter 8", async () => {
    const ranker = createRanker(dependencies(async () => []));
    await expect(
      runSearch(
        { queryText: "lamp", levelId: meta.id },
        { levels: [meta], rankers: new Map([[meta.id, ranker]]), levers, clock, categories: [] },
      ),
    ).rejects.toThrow("Cross-encoder returned 0 scores for 50 candidates");
  });
});
