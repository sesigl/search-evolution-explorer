import { describe, expect, it } from "vitest";
import type { Judgment } from "../types/evaluation.ts";
import { judgmentsWithLogBait, ndcgOnJudgments, ndcgWithLogBait } from "./evaluate-ranker.ts";
import { FEATURE_NAMES } from "./features.ts";

describe("ranker evaluation on judgments", () => {
  it("Given a grade-0 item ranked above a relevant item, When NDCG is computed, Then the score uses the judgment set only", () => {
    const model = {
      variant: "naive" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map(() => 0),
      bias: 0,
    };
    const ndcg = ndcgOnJudgments(
      model,
      [
        { queryText: "q", itemId: "good", grade: 3 },
        { queryText: "q", itemId: "bait", grade: 0 },
      ],
      (_query, itemId) => [itemId === "good" ? 1 : 0, 0, 0, 0, 0, 0],
    );
    expect(ndcg).toBeCloseTo(1 / Math.log2(3), 8);
  });

  it("Given no judgments, When NDCG is computed, Then the value is 0", () => {
    const model = {
      variant: "naive" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map(() => 0),
      bias: 0,
    };
    expect(ndcgOnJudgments(model, [], () => [0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it("Given a judged item without features, When NDCG is computed, Then that item is omitted from the ranking", () => {
    const model = {
      variant: "naive" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map((_, index) => (index === 0 ? 1 : 0)),
      bias: 0,
    };
    const ndcg = ndcgOnJudgments(
      model,
      [
        { queryText: "q", itemId: "missing", grade: 3 },
        { queryText: "q", itemId: "good", grade: 3 },
      ],
      (_query, itemId) => (itemId === "good" ? [1, 0, 0, 0, 0, 0] : undefined),
    );
    expect(ndcg).toBeCloseTo(1 / (1 + 1 / Math.log2(3)), 8);
  });

  it("Given a log-top item missing from the judgments, When NDCG with log bait is computed, Then that item is graded 0", () => {
    const model = {
      variant: "naive" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map(() => 0),
      bias: 0,
    };
    const ndcg = ndcgWithLogBait(
      model,
      [{ queryText: "q", itemId: "good", grade: 3 }],
      [
        {
          sessionId: "s",
          queryText: "q",
          shownItemIds: ["bait", "good"],
          clickedItemIds: ["bait"],
        },
      ],
      (_query, itemId) => [itemId === "good" ? 1 : 0, 0, 0, 0, 0, 0],
    );
    expect(ndcg).toBeCloseTo(1 / Math.log2(3), 8);
  });

  it("Given two queries, When NDCG is computed, Then each query is scored on its own judgments and the result is the mean", () => {
    const model = {
      variant: "naive" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map((_, index) => (index === 0 ? 1 : 0)),
      bias: 0,
    };
    const ndcg = ndcgOnJudgments(
      model,
      [
        { queryText: "q1", itemId: "good", grade: 3 },
        { queryText: "q1", itemId: "bait", grade: 0 },
        { queryText: "q2", itemId: "bait", grade: 3 },
        { queryText: "q2", itemId: "good", grade: 0 },
      ],
      (_query, itemId) => [itemId === "good" ? 1 : 0, 0, 0, 0, 0, 0],
    );
    expect(ndcg).toBeCloseTo((1 + 1 / Math.log2(3)) / 2, 8);
  });

  it("adds one grade-0 bait judgment per unseen shown listing, ignoring repeats", () => {
    const bait = judgmentsWithLogBait(
      [{ queryText: "q", itemId: "judged", grade: 3 }],
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["judged", "bait", "bait"],
          clickedItemIds: [],
        },
        { sessionId: "s2", queryText: "q", shownItemIds: ["bait", "extra"], clickedItemIds: [] },
      ],
    );
    expect(bait).toEqual([
      { queryText: "q", itemId: "judged", grade: 3 },
      { queryText: "q", itemId: "bait", grade: 0 },
      { queryText: "q", itemId: "extra", grade: 0 },
    ]);
  });

  it("returns the judgments unchanged when no session shows an unjudged listing", () => {
    const judgments: Judgment[] = [{ queryText: "q", itemId: "judged", grade: 3 }];
    expect(
      judgmentsWithLogBait(judgments, [
        { sessionId: "s1", queryText: "q", shownItemIds: ["judged"], clickedItemIds: [] },
      ]),
    ).toEqual(judgments);
  });
});
