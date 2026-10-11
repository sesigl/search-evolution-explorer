import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import { createRanker as createLevel1 } from "../levels/level-1-lexical.ts";
import { levels } from "../levels/level-registry.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { UseCaseError } from "../search/errors.ts";
import type { SearchDeps } from "../search/run-search.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { compareLevels } from "./compare-levels.ts";

const levers: LeverConfiguration = {
  stopWords: ["a", "the"],
  synonymGroups: [["sofa", "couch"]],
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
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
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
    rankers: new Map([["level-1-lexical", createLevel1({ corpus, index, levers, clock })]]),
    levers,
    clock,
    categories: [],
  };
}

describe("compare levels", () => {
  it.each([
    ["level-4-hybrid", "level-5-cross-encoder"],
    ["level-5-cross-encoder", "level-4-hybrid"],
  ])(
    "explains %s versus %s as reranking, even when the short list is narrower",
    async (leftLevelId, rightLevelId) => {
      const listings = [item("a", "lamp"), item("b", "lamp")];
      const score = (_understanding: unknown, candidate: CorpusItem) => ({
        item: candidate,
        score: 1,
        signals: [],
      });
      const output = await compareLevels(
        { queryText: "lamp", leftLevelId, rightLevelId },
        {
          ...depsWith([]),
          rankers: new Map([
            ["level-4-hybrid", { match: () => ({ items: listings }), score }],
            ["level-5-cross-encoder", { match: () => ({ items: listings.slice(1) }), score }],
          ]),
        },
      );
      expect(output.membershipKind).toBe("scoring");
      expect([...output.entered, ...output.exited].map((row) => row.reason)).toEqual([
        expect.stringContaining("scoring:"),
      ]);
    },
  );
  it("Given the same level on both sides, When comparison runs, Then the request is rejected", async () => {
    await expect(
      compareLevels(
        { queryText: "sofa", leftLevelId: "level-1-lexical", rightLevelId: "level-1-lexical" },
        depsWith([]),
      ),
    ).rejects.toThrow(UseCaseError);
  });

  it("Given identical rankings, When comparison runs, Then a distinguishing query is suggested", async () => {
    const output = await compareLevels(
      { queryText: "sofa", leftLevelId: "level-0-evaluation", rightLevelId: "level-1-lexical" },
      depsWith([item("x", "unrelated lamp")]),
    );
    expect(output.identical).toBe(true);
    expect(output.suggestedDistinguishingQuery).toBe("couch");
  });

  it("Given a result limit, When comparison runs, Then both sides honour the limit", async () => {
    const output = await compareLevels(
      {
        queryText: "lamp",
        leftLevelId: "level-1-lexical",
        rightLevelId: "level-0-evaluation",
        limit: 1,
      },
      depsWith([item("a", "lamp"), item("b", "lamp")]),
    );
    expect(output.left.results.length).toBeLessThanOrEqual(1);
    expect(output.right.results).toEqual([]);
  });
});
