import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import { createRanker } from "../levels/level-1-lexical.ts";
import { levels } from "../levels/level-registry.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { UseCaseError } from "./errors.ts";
import { runSearch, type SearchDeps } from "./run-search.ts";

const levers: LeverConfiguration = {
  stopWords: ["a", "an", "the"],
  synonymGroups: [["sofa", "couch"]],
  variantRules: [{ pattern: "e bike", canonical: "ebike" }],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(id: string, title: string, available = true): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available,
  };
}

function depsWith(items: readonly CorpusItem[]): SearchDeps {
  const corpus: CorpusSource = {
    readItems: async () => items,
    readCategories: async () => [],
  };
  const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
  return {
    levels,
    rankers: new Map([["level-1-lexical", createRanker({ corpus, index, levers, clock })]]),
    levers,
    clock,
    categories: [],
  };
}

describe("search", () => {
  it("Given an empty query, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "   ", levelId: "level-1-lexical" }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given a query that matches nothing, When search runs, Then zero results are returned as success with an explanation", async () => {
    const output = await runSearch(
      { queryText: "unicorn", levelId: "level-1-lexical" },
      depsWith([item("sofa", "Blue sofa")]),
    );
    expect(output.results).toEqual([]);
    expect(output.understanding.rawText).toBe("unicorn");
    expect(output.level.id).toBe("level-1-lexical");
    expect(output.level.mechanism.length).toBeGreaterThan(0);
  });

  it("Given an unavailable listing that contains the query terms, When search runs, Then the listing is excluded", async () => {
    const output = await runSearch(
      { queryText: "camera", levelId: "level-1-lexical" },
      depsWith([item("sold", "Sold camera body", false), item("live", "Live camera")]),
    );
    expect(output.results.map((result) => result.item.id)).toEqual(["live"]);
  });

  it("Given an unknown level, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "sofa", levelId: "level-99" }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given a forward-preview level, When search runs, Then the request is rejected", async () => {
    const lexical = levels.find((level) => level.id === "level-1-lexical");
    if (lexical === undefined) {
      throw new Error("level-1-lexical is missing from the registry");
    }
    const preview = {
      ...lexical,
      id: "level-9-preview",
      label: "Cross-encoder preview",
      implemented: false,
    };
    await expect(
      runSearch(
        { queryText: "sofa", levelId: "level-9-preview" },
        { ...depsWith([]), levels: [...levels, preview] },
      ),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given a query longer than 200 characters, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "a".repeat(201), levelId: "level-1-lexical" }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given the evaluation level, When search runs, Then zero results are returned with the evaluation explanation", async () => {
    const output = await runSearch(
      { queryText: "sofa", levelId: "level-0-evaluation" },
      depsWith([item("sofa", "Blue sofa")]),
    );
    expect(output.results).toEqual([]);
    expect(output.level.id).toBe("level-0-evaluation");
    expect(output.candidateWidth).toBe(0);
  });

  it("Given a limit below 1, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "sofa", levelId: "level-1-lexical", limit: 0 }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given a limit above 50, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "sofa", levelId: "level-1-lexical", limit: 51 }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given an offset, When search runs, Then the page starts at that index and positions stay global", async () => {
    const output = await runSearch(
      { queryText: "lamp", levelId: "level-1-lexical", limit: 1, offset: 1 },
      depsWith([item("a-lamp", "lamp"), item("b-lamp", "lamp")]),
    );
    expect(output.results.map((result) => result.item.id)).toEqual(["b-lamp"]);
    expect(output.results[0]?.position).toBe(2);
    expect(output.candidateWidth).toBe(2);
  });

  it("Given a negative offset, When search runs, Then the request is rejected", async () => {
    await expect(
      runSearch({ queryText: "sofa", levelId: "level-1-lexical", offset: -1 }, depsWith([])),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given listings with different term frequency, When search runs, Then the higher score is ranked first", async () => {
    const output = await runSearch(
      { queryText: "lamp", levelId: "level-1-lexical" },
      depsWith([item("once", "lamp"), item("twice", "lamp lamp")]),
    );
    expect(output.results[0]?.item.id).toBe("twice");
    expect(output.results[1]?.item.id).toBe("once");
  });

  it("Given two listings with the same text, When search runs, Then equal scores keep a stable id order", async () => {
    const output = await runSearch(
      { queryText: "lamp", levelId: "level-1-lexical", limit: 2 },
      depsWith([item("b-lamp", "lamp"), item("a-lamp", "lamp")]),
    );
    expect(output.results.map((result) => result.item.id)).toEqual(["a-lamp", "b-lamp"]);
  });

  it("Given a level that needs a missing artifact, When search runs, Then the request is rejected as a precondition failure", async () => {
    await expect(
      runSearch(
        { queryText: "sofa", levelId: "level-3-learned" },
        depsWith([item("sofa", "Blue sofa")]),
      ),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given a matching query, When search runs, Then results include named signals, elapsed time, and a level explanation", async () => {
    const output = await runSearch(
      { queryText: "sofa", levelId: "level-1-lexical" },
      depsWith([item("sofa", "Blue sofa")]),
    );
    expect(output.results[0]?.item.id).toBe("sofa");
    expect(output.results[0]?.position).toBe(1);
    expect(output.results[0]?.signals[0]?.name).toBe("bm25");
    expect(output.level.mechanism.length).toBeGreaterThan(0);
    expect(output.level.tradeOff.length).toBeGreaterThan(0);
    expect(output.level.fixesFailureMode?.length ?? 0).toBeGreaterThan(0);
    expect(output.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(output.candidateWidth).toBe(1);
  });
});
