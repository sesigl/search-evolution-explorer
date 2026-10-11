import { describe, expect, it } from "vitest";
import { levels } from "../levels/level-registry.ts";
import type { Clock } from "../ports/clock.ts";
import type { SearchDeps } from "../search/run-search.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { LevelRanker } from "../types/level.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { assembleScorecard } from "./scorecard.ts";

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

function item(id: string): CorpusItem {
  return {
    id,
    title: "lamp",
    description: "",
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function ranker(items: readonly CorpusItem[]): LevelRanker {
  return {
    match() {
      return { items };
    },
    score(_understanding, candidate) {
      return { item: candidate, score: 1, signals: [] };
    },
  };
}

describe("evaluation reproducibility", () => {
  it("Given unchanged artifacts, When evaluation runs twice, Then the reported numbers are identical", async () => {
    const items = [item("a"), item("b")];
    const judgments: Judgment[] = [{ queryText: "lamp", itemId: "a", grade: 3 }];
    const deps: SearchDeps = {
      levels,
      rankers: new Map([["level-1-lexical", ranker(items)]]),
      levers,
      clock,
      categories: [],
    };
    const first = await assembleScorecard(["level-1-lexical"], judgments, deps);
    const second = await assembleScorecard(["level-1-lexical"], judgments, deps);
    expect(first).toEqual(second);
  });
});
