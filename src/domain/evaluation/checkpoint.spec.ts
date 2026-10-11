import { describe, expect, it } from "vitest";
import type { Scorecard, ScorecardRun } from "../types/evaluation.ts";
import type { EvolutionLevel } from "../types/level.ts";
import { checkpointFor } from "./checkpoint.ts";

function level(id: string, ordinal: number, label: string): EvolutionLevel {
  return {
    id,
    ordinal,
    label,
    capability: "",
    changes: "both",
    mechanism: "",
    tradeOff: "",
    fixesFailureMode: null,
    prerequisites: [],
    sourceSpecifier: "",
    implemented: true,
    guidedExamples: [],
    candidateWidth: 0,
  };
}

function run(levelId: string, ndcgAt10: number, perQuery: Record<string, number>): ScorecardRun {
  return {
    levelId,
    ndcgAt10,
    mrr: 0,
    recallAt50: 0,
    msPerQueryP50: 0,
    msPerQueryP95: 0,
    perQuery: Object.entries(perQuery).map(([queryText, score]) => ({
      queryText,
      ndcgAt10: score,
      deltaVsPreviousLevel: 0,
    })),
    groundTruthDisclosure: "",
  };
}

const LEVELS = [
  level("level-0-evaluation", 0, "Evaluation"),
  level("level-1-lexical", 1, "Lexical"),
  level("level-2-boosting", 2, "Boosting"),
];

const SCORECARD: Scorecard = {
  runs: [
    run("level-0-evaluation", 0, { camera: 0, sofa: 0 }),
    run("level-1-lexical", 0.5, { camera: 0.4, sofa: 0.6, bikes: 0 }),
    run("level-2-boosting", 0.6, { camera: 0.7, sofa: 0.5, bikes: 0 }),
  ],
  regressions: [{ levelId: "level-2-boosting", queryText: "sofa", delta: -0.1 }],
};

describe("checkpointFor", () => {
  it("compares a chapter with the chapter before it, leaving the introduction out", () => {
    const checkpoint = checkpointFor(SCORECARD, LEVELS, "level-2-boosting", "camera");
    expect(checkpoint?.previous?.levelId).toBe("level-1-lexical");
    expect(checkpoint?.rungs.map((rung) => rung.ordinal)).toEqual([1, 2]);
    expect(checkpoint?.rungs.map((rung) => rung.foundCount)).toEqual([2, 2]);
    expect(checkpoint?.regressionCount).toBe(1);
    expect(checkpoint?.worstRegression).toEqual({ queryText: "sofa", delta: -0.1 });
    expect(
      checkpointFor(SCORECARD, LEVELS, "level-1-lexical", "camera")?.worstRegression,
    ).toBeNull();
    expect(checkpoint?.queryCount).toBe(3);
    expect(checkpoint?.forQuery).toEqual({
      queryText: "camera",
      ndcgAt10: 0.7,
      previousNdcgAt10: 0.4,
    });
  });

  it("has no previous rung for the first chapter and no query row for an unjudged query", () => {
    const checkpoint = checkpointFor(SCORECARD, LEVELS, "level-1-lexical", "unjudged query");
    expect(checkpoint?.previous).toBeNull();
    expect(checkpoint?.forQuery).toBeNull();
    expect(checkpointFor(SCORECARD, LEVELS, "level-1-lexical", "camera")?.forQuery).toEqual({
      queryText: "camera",
      ndcgAt10: 0.4,
      previousNdcgAt10: null,
    });
  });

  it("is null for the introduction and for a chapter that has no run", () => {
    expect(checkpointFor(SCORECARD, LEVELS, "level-0-evaluation", "camera")).toBeNull();
    expect(checkpointFor(SCORECARD, LEVELS, "level-4-hybrid", "camera")).toBeNull();
  });

  it("keeps the largest drop when a chapter regresses on several queries", () => {
    const scorecard: Scorecard = {
      runs: [
        run("level-1-lexical", 0.5, { camera: 0.5 }),
        run("level-2-boosting", 0.4, { camera: 0.4 }),
      ],
      regressions: [
        { levelId: "level-2-boosting", queryText: "worst", delta: -0.3 },
        { levelId: "level-2-boosting", queryText: "mild", delta: -0.1 },
      ],
    };
    const checkpoint = checkpointFor(scorecard, LEVELS, "level-2-boosting", "camera");
    expect(checkpoint?.regressionCount).toBe(2);
    expect(checkpoint?.worstRegression).toEqual({ queryText: "worst", delta: -0.3 });
  });

  it("reports the held-out score when the split is present and null otherwise", () => {
    const scorecard: Scorecard = {
      runs: [run("level-6-two-tower", 0.68, { camera: 0.68 })],
      regressions: [],
      heldOut: {
        runs: [run("level-6-two-tower", 0.71, { camera: 0.71, sofa: 0.71 })],
        regressions: [],
      },
    };
    const checkpoint = checkpointFor(
      scorecard,
      [level("level-6-two-tower", 6, "Two-tower")],
      "level-6-two-tower",
      "camera",
    );
    expect(checkpoint?.heldOut).toEqual({ ndcgAt10: 0.71, queryCount: 2 });
    expect(checkpointFor(SCORECARD, LEVELS, "level-1-lexical", "camera")?.heldOut).toBeNull();
  });
});
