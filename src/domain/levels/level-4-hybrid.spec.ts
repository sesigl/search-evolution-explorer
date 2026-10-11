import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import type { VectorStore } from "../ports/vector-store.ts";
import { understand } from "../query-understanding/understand.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker } from "./level-4-hybrid.ts";

const levers: LeverConfiguration = {
  stopWords: [],
  synonymGroups: [],
  variantRules: [],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(id: string, title: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "electronics",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

describe("level 4 hybrid search", () => {
  it("Given a vector-only neighbour, When level 4 matches, Then the candidate set is wider than level 3", () => {
    const lexical = item("phone", "Apple iPhone 13");
    const neighbour = item("paraphrase", "Unlocked smartphone");
    const items = [lexical, neighbour];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const store: VectorStore = {
      getVector(itemId) {
        return itemId === "paraphrase" ? Float32Array.from([1, 0]) : Float32Array.from([0, 1]);
      },
      itemIds() {
        return ["phone", "paraphrase"];
      },
      dimensions() {
        return 2;
      },
    };
    const ranker = createRanker({ corpus, index, levers, clock, vectorStore: store });
    const understanding = {
      ...understand("iphone", levers, {}, []),
      queryVector: Float32Array.from([1, 0]),
    };
    const matched = ranker.match(understanding);
    expect(matched.items.map((entry) => entry.id)).toContain("paraphrase");
    expect(matched.items.map((entry) => entry.id)).toContain("phone");
    const scored = matched.items.map((entry) => ranker.score(understanding, entry));
    scored.sort(
      (left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id),
    );
    expect(scored.map((entry) => entry.item.id)).toEqual(matched.items.map((entry) => entry.id));
    expect(scored[0]?.signals.some((signal) => signal.name === "rrf")).toBe(true);
    expect(
      ranker
        .score(understanding, neighbour)
        .signals.find((signal) => signal.name === "vectorSimilarity")?.value,
    ).toBe(1);
  });

  it("Given no embeddings, When the ranker is created, Then matching does not throw and stays lexical", () => {
    const listing = item("phone", "Apple iPhone 13");
    const corpus: CorpusSource = {
      readItems: async () => [listing],
      readCategories: async () => [],
    };
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    const ranker = createRanker({ corpus, index, levers, clock });
    const matched = ranker.match(understand("iphone", levers, {}, []));
    expect(matched.items.map((entry) => entry.id)).toEqual(["phone"]);
    const scored = ranker.score(understand("iphone", levers, {}, []), listing);
    expect(scored.signals.some((signal) => signal.name === "vectorSimilarity")).toBe(true);
  });
});
