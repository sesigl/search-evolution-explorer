import { describe, expect, it } from "vitest";
import { levels } from "../levels/level-registry.ts";
import type { Clock } from "../ports/clock.ts";
import { UseCaseError } from "../search/errors.ts";
import type { SearchDeps } from "../search/run-search.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { LevelRanker } from "../types/level.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { assembleScorecard, WANDS_GROUND_TRUTH_DISCLOSURE } from "./scorecard.ts";

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
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function rankerWithOrder(order: readonly string[], items: readonly CorpusItem[]): LevelRanker {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  return {
    match() {
      return {
        items: order.flatMap((id) => {
          const found = byId.get(id);
          return found === undefined ? [] : [found];
        }),
      };
    },
    score(_understanding, candidate) {
      const position = order.indexOf(candidate.id);
      return { item: candidate, score: order.length - position, signals: [] };
    },
  };
}

function depsWith(rankers: SearchDeps["rankers"]): SearchDeps {
  return {
    levels,
    rankers,
    levers,
    clock,
    categories: [],
  };
}

describe("scorecard assembly", () => {
  const items = [item("good", "good lamp"), item("bad", "bad lamp")];
  const judgments: Judgment[] = [
    { queryText: "lamp", itemId: "good", grade: 3 },
    { queryText: "chair", itemId: "good", grade: 2 },
  ];

  it("Given a fixed query holdout, When all queries are graded once, Then held-out metrics exclude training queries", async () => {
    const deps = depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]]));
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [
        { queryText: "lamp", itemId: "good", grade: 3 },
        { queryText: "chair", itemId: "missing", grade: 3 },
      ],
      deps,
      new Map(),
      new Set(["chair"]),
    );
    expect(scorecard.runs[0]?.ndcgAt10).toBe(0.5);
    expect(scorecard.heldOut?.runs[0]).toMatchObject({ ndcgAt10: 0, mrr: 0, recallAt50: 0 });
    expect(scorecard.heldOut?.runs[0]?.perQuery.map((row) => row.queryText)).toEqual(["chair"]);
  });

  it("Given two levels, When the scorecard is assembled, Then each run has a per-query breakdown and the disclosure", async () => {
    const deps = depsWith(
      new Map([
        ["level-1-lexical", rankerWithOrder(["good", "bad"], items)],
        ["level-2-boosting", rankerWithOrder(["bad", "good"], items)],
      ]),
    );
    const scorecard = await assembleScorecard(
      ["level-1-lexical", "level-2-boosting"],
      judgments,
      deps,
    );
    expect(scorecard.runs).toHaveLength(2);
    for (const run of scorecard.runs) {
      expect(run.perQuery.map((row) => row.queryText)).toEqual(["chair", "lamp"]);
      expect(run.groundTruthDisclosure).toBe(WANDS_GROUND_TRUTH_DISCLOSURE);
    }
    expect(scorecard.runs[0]?.perQuery.every((row) => row.deltaVsPreviousLevel === 0)).toBe(true);
  });

  it("Given a query where the higher level is worse, When the scorecard is assembled, Then the regression is listed not filtered", async () => {
    const deps = depsWith(
      new Map([
        ["level-1-lexical", rankerWithOrder(["good", "bad"], items)],
        ["level-2-boosting", rankerWithOrder(["bad", "good"], items)],
      ]),
    );
    const scorecard = await assembleScorecard(
      ["level-1-lexical", "level-2-boosting"],
      judgments,
      deps,
    );
    const lampRegression = scorecard.regressions.find((row) => row.queryText === "lamp");
    expect(lampRegression?.levelId).toBe("level-2-boosting");
    expect(lampRegression?.delta).toBeLessThan(0);
    expect(scorecard.regressions.length).toBeGreaterThan(0);
    for (const row of scorecard.regressions) {
      expect(row).toEqual({
        levelId: expect.any(String),
        queryText: expect.any(String),
        delta: expect.any(Number),
      });
    }
  });

  it("Given an unknown level id, When the scorecard is assembled, Then the request is rejected", async () => {
    await expect(assembleScorecard(["level-99"], judgments, depsWith(new Map()))).rejects.toThrow(
      "Unknown level: level-99",
    );
  });

  it("Given no judgments, When the scorecard is assembled, Then the request is rejected", async () => {
    try {
      await assembleScorecard(undefined, [], depsWith(new Map()));
      expect.unreachable("expected missing judgments to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(UseCaseError);
      expect(error).toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Judgments are missing. Rebuild with npm run data:clicks.",
      });
    }
  });

  it("Given two queries, When the scorecard is assembled, Then NDCG, MRR, and recall are the mean across queries", async () => {
    const deps = depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]]));
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [
        { queryText: "lamp", itemId: "good", grade: 3 },
        { queryText: "chair", itemId: "missing", grade: 3 },
      ],
      deps,
    );
    expect(scorecard.runs[0]?.ndcgAt10).toBe(0.5);
    expect(scorecard.runs[0]?.mrr).toBe(0.5);
    expect(scorecard.runs[0]?.recallAt50).toBe(0.5);
    expect(scorecard.runs[0]?.groundTruthDisclosure.includes("WANDS")).toBe(true);
    expect(scorecard.regressions).toEqual([]);
  });

  it("Given no level ids, When the scorecard is assembled, Then implemented levels with rankers are evaluated in ordinal order", async () => {
    const deps = {
      ...depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]])),
      levels: [...levels].reverse(),
    };
    const fromUndefined = await assembleScorecard(undefined, judgments, deps);
    const fromEmpty = await assembleScorecard([], judgments, deps);
    expect(fromUndefined.runs.map((run) => run.levelId)).toEqual([
      "level-0-evaluation",
      "level-1-lexical",
    ]);
    expect(fromEmpty.runs.map((run) => run.levelId)).toEqual(
      fromUndefined.runs.map((run) => run.levelId),
    );
  });

  it("Given an advancing clock, When the scorecard is assembled, Then p50 and p95 cost use the sorted elapsed times", async () => {
    const times = [0, 100, 100, 101, 101, 111, 111, 113];
    let index = 0;
    const advancing: Clock = {
      now() {
        const stamp = times[index] ?? 0;
        index += 1;
        return new Date(stamp);
      },
    };
    const deps: SearchDeps = {
      ...depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]])),
      clock: advancing,
    };
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [
        { queryText: "a", itemId: "good", grade: 3 },
        { queryText: "b", itemId: "good", grade: 3 },
        { queryText: "c", itemId: "good", grade: 3 },
        { queryText: "d", itemId: "good", grade: 3 },
      ],
      deps,
    );
    expect(scorecard.runs[0]?.msPerQueryP50).toBe(2);
    expect(scorecard.runs[0]?.msPerQueryP95).toBe(10);
  });

  it("Given only a grade-0 judgment, When the scorecard is assembled, Then recall and MRR are 0", async () => {
    const deps = depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]]));
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [{ queryText: "lamp", itemId: "good", grade: 0 }],
      deps,
    );
    expect(scorecard.runs[0]?.recallAt50).toBe(0);
    expect(scorecard.runs[0]?.mrr).toBe(0);
  });

  it("Given the only relevant item at rank 50, When the scorecard is assembled, Then Recall@50 is 1", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => `item-${String(index).padStart(2, "0")}`);
    const listings = ids.map((id) => item(id, `${id} lamp`));
    const relevantId = ids[49] as string;
    const deps = depsWith(new Map([["level-1-lexical", rankerWithOrder(ids, listings)]]));
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [{ queryText: "lamp", itemId: relevantId, grade: 3 }],
      deps,
    );
    expect(scorecard.runs[0]?.recallAt50).toBe(1);
    expect(scorecard.runs[0]?.ndcgAt10).toBe(0);
  });

  it("Given a grade-3 item at rank 1, When the scorecard is assembled, Then NDCG@10 is 1", async () => {
    const deps = depsWith(new Map([["level-1-lexical", rankerWithOrder(["good", "bad"], items)]]));
    const scorecard = await assembleScorecard(
      ["level-1-lexical"],
      [{ queryText: "lamp", itemId: "good", grade: 3 }],
      deps,
    );
    expect(scorecard.runs[0]?.ndcgAt10).toBe(1);
    expect(scorecard.runs[0]?.mrr).toBe(1);
    expect(scorecard.regressions).toEqual([]);
    expect(Number.isFinite(scorecard.runs[0]?.msPerQueryP50)).toBe(true);
    expect(Number.isFinite(scorecard.runs[0]?.msPerQueryP95)).toBe(true);
  });

  it("Given a query vector for a query, When the scorecard runs a vector-aware ranker, Then the hybrid item is ranked", async () => {
    const hybrid = item("hybrid", "vector lamp");
    const lexical = item("lexical", "text lamp");
    const ranker: LevelRanker = {
      match(understanding) {
        if (understanding.queryVector === null) {
          return { items: [lexical] };
        }
        return { items: [hybrid] };
      },
      score(_understanding, candidate) {
        return { item: candidate, score: 1, signals: [] };
      },
    };
    const scorecard = await assembleScorecard(
      ["level-4-hybrid"],
      [{ queryText: "lamp", itemId: "hybrid", grade: 3 }],
      depsWith(new Map([["level-4-hybrid", ranker]])),
      new Map([["lamp", Float32Array.from([1, 0])]]),
    );
    expect(scorecard.runs[0]?.ndcgAt10).toBe(1);
  });
});
