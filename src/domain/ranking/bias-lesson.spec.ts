import { describe, expect, it } from "vitest";
import type { TrainedRankingModel } from "../types/level.ts";
import type { BiasLessonInput } from "./bias-lesson.ts";
import { buildBiasLesson } from "./bias-lesson.ts";
import { FEATURE_NAMES } from "./features.ts";

/** Feature vector: bm25 = first, categoryMatch = second, termOverlap = last. */
function featuresForNaiveVsCorrected(queryText: string, itemId: string): number[] | undefined {
  if (itemId === "bait") {
    return [1, 0, 0, 0, 0, 0];
  }
  if (itemId === "good") {
    return [0, 1, 0, 0, 0, 0];
  }
  return undefined;
}

function model(variant: "naive" | "corrected", weightIndex: number): TrainedRankingModel {
  return {
    variant,
    featureNames: FEATURE_NAMES,
    weights: FEATURE_NAMES.map((_, index) => (index === weightIndex ? 1 : 0)),
    bias: 0,
  };
}

const CHAPTERS = { learned: 8, boosted: 7 } as const;

function session(
  sessionId: string,
  clicked: readonly string[],
  shown: readonly string[] = ["bait", "good"],
): BiasLessonInput["sessions"][number] {
  return { sessionId, queryText: "q", shownItemIds: shown, clickedItemIds: clicked };
}

describe("bias lesson assembly", () => {
  it("Given two models, When the lesson is built, Then the disclosure, both curves and the chapter numbers are present", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q", itemId: "good", grade: 3 },
        { queryText: "q", itemId: "bait", grade: 0 },
      ],
      sessions: Array.from({ length: 6 }, (_, index) => session(`s-${index}`, ["bait"])),
      propensity: { estimatedDecay: [1, 0.5], trueDecay: [1, 0.5] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
    });
    expect(lesson.chapters).toEqual({ learned: 8, boosted: 7 });
    expect(lesson.propensity.estimatedDecay).toEqual([1, 0.5]);
    expect(lesson.correctionTechnique.length).toBeGreaterThan(0);
    expect(lesson.queryCount).toBe(1);
    expect(lesson.corrected.ndcgAt10).toBe(1);
    expect(lesson.naive.ndcgAt10).toBeLessThan(1);
    expect(lesson.gap).toBeCloseTo(1 - lesson.naive.ndcgAt10, 8);
    expect(lesson.dataDisclosure).toEqual({
      sessionCount: 6,
      clickCount: 6,
      queryCount: 1,
      positionCount: 2,
    });
  });

  it("Given the log page, When the lesson is built, Then each item carries clicks, sessions, grades and both scores", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q", itemId: "good", grade: 3 },
        { queryText: "q", itemId: "bait", grade: 0 },
      ],
      sessions: [
        session("s-0", ["bait"]),
        session("s-1", ["bait"]),
        session("s-2", ["good"]),
        session("s-3", []),
      ],
      propensity: { estimatedDecay: [1, 0.5], trueDecay: [1, 0.5] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
    });
    expect(lesson.logExamples).toHaveLength(1);
    const example = lesson.logExamples[0];
    expect(example?.queryText).toBe("q");
    expect(example?.items).toEqual([
      {
        itemId: "bait",
        logPosition: 1,
        clicks: 2,
        sessions: 4,
        grade: 0,
        naiveScore: 1,
        correctedScore: 0,
      },
      {
        itemId: "good",
        logPosition: 2,
        clicks: 1,
        sessions: 4,
        grade: 3,
        naiveScore: 0,
        correctedScore: 1,
      },
    ]);
  });

  it("Given a searcher clicks a grade-0 item, When the lesson is built, Then that item is listed as clicked bait", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q", itemId: "good", grade: 3 },
        { queryText: "q", itemId: "bait", grade: 0 },
      ],
      sessions: [session("s", ["bait"])],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
    });
    expect(lesson.clickedBaitExamples).toEqual([
      { queryText: "q", itemId: "bait", logPosition: 1, clicks: 1, sessions: 1, grade: 0 },
    ]);
  });

  it("Given nobody clicks the grade-0 item, When the lesson is built, Then it is not listed as clicked bait", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 1),
      corrected: model("corrected", 1),
      judgments: [{ queryText: "q", itemId: "bait", grade: 0 }],
      sessions: [session("s", [])],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
    });
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given a clicked item is relevant, When the lesson is built, Then it is not listed as clicked bait", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q", itemId: "bait", grade: 2 },
        { queryText: "q", itemId: "good", grade: 3 },
      ],
      sessions: [session("s", ["bait"])],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
    });
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given many queries and cases, When the lesson is built, Then the log examples and the table honour their limits", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q1", itemId: "good", grade: 3 },
        { queryText: "q1", itemId: "bait", grade: 0 },
        { queryText: "q2", itemId: "good", grade: 3 },
        { queryText: "q2", itemId: "bait", grade: 0 },
      ],
      sessions: [
        {
          sessionId: "s1",
          queryText: "q1",
          shownItemIds: ["bait", "good"],
          clickedItemIds: ["bait"],
        },
        {
          sessionId: "s2",
          queryText: "q2",
          shownItemIds: ["bait", "good"],
          clickedItemIds: ["bait"],
        },
      ],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
      labQueryLimit: 1,
      baitLimit: 1,
    });
    expect(lesson.logExamples).toHaveLength(1);
    expect(lesson.logExamples[0]?.queryText).toBe("q1");
    expect(lesson.logExamples[0]?.items).toHaveLength(2);
    expect(lesson.clickedBaitExamples).toHaveLength(1);
    expect(lesson.clickedBaitExamples[0]?.queryText).toBe("q1");
  });

  it("Given one query with a relevant listing and one without, When the lesson is built, Then the lab prefers the query with contrast", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [{ queryText: "q-mixed", itemId: "mgood", grade: 3 }],
      sessions: [
        {
          sessionId: "s1",
          queryText: "q-case-only",
          shownItemIds: ["x1", "x2", "y1", "y2"],
          clickedItemIds: ["x1", "x2"],
        },
        {
          sessionId: "s2",
          queryText: "q-mixed",
          shownItemIds: ["mx", "my", "mgood"],
          clickedItemIds: ["mx"],
        },
      ],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: (_queryText, itemId) =>
        itemId.startsWith("x") || itemId === "mx" ? [1, 0, 0, 0, 0, 0] : [0, 1, 0, 0, 0, 0],
      chapters: CHAPTERS,
      labQueryLimit: 1,
    });
    expect(lesson.logExamples[0]?.queryText).toBe("q-mixed");
    expect(lesson.clickedBaitExamples).toHaveLength(3);
  });

  it("Given a one-item page size, When the lesson is built, Then the log keeps only the first shown item", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [{ queryText: "q", itemId: "good", grade: 3 }],
      sessions: [session("s", ["bait"])],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
      labPageSize: 1,
    });
    expect(lesson.logExamples[0]?.items.map((item) => item.itemId)).toEqual(["bait"]);
    expect(lesson.clickedBaitExamples).toHaveLength(1);
  });

  it("Given a query scope, When the lesson is built, Then only those queries are scored, logged and counted", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "teaching", itemId: "good", grade: 3 },
        { queryText: "filler", itemId: "good", grade: 3 },
        { queryText: "filler", itemId: "bait", grade: 0 },
      ],
      sessions: [
        {
          sessionId: "s1",
          queryText: "teaching",
          shownItemIds: ["good"],
          clickedItemIds: ["good"],
        },
        {
          sessionId: "s2",
          queryText: "filler",
          shownItemIds: ["bait", "good"],
          clickedItemIds: ["bait"],
        },
      ],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: featuresForNaiveVsCorrected,
      chapters: CHAPTERS,
      queryScope: new Set(["teaching"]),
    });
    expect(lesson.queryCount).toBe(1);
    expect(lesson.naive.ndcgAt10).toBe(1);
    expect(lesson.corrected.ndcgAt10).toBe(1);
    expect(lesson.logExamples.map((entry) => entry.queryText)).toEqual(["teaching"]);
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given no judgments, When the lesson is built, Then NDCG is 0", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 0),
      judgments: [],
      sessions: [],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: () => [0, 0, 0, 0, 0, 0],
      chapters: CHAPTERS,
    });
    expect(lesson.naive.ndcgAt10).toBe(0);
    expect(lesson.corrected.ndcgAt10).toBe(0);
    expect(lesson.logExamples).toEqual([]);
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given a shown item without features, When the lesson is built, Then it is skipped in the log and the table", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [
        { queryText: "q", itemId: "missing", grade: 0 },
        { queryText: "q", itemId: "bait", grade: 0 },
      ],
      sessions: [
        {
          sessionId: "s",
          queryText: "q",
          shownItemIds: ["missing", "bait"],
          clickedItemIds: ["missing"],
        },
      ],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: (_queryText, itemId) => (itemId === "bait" ? [1, 0, 0, 0, 0, 0] : undefined),
      chapters: CHAPTERS,
    });
    expect(lesson.logExamples[0]?.items.map((item) => item.itemId)).toEqual(["bait"]);
  });

  it("Given a session with no shown items, When the lesson is built, Then it contributes no log rows", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 1),
      judgments: [{ queryText: "q", itemId: "bait", grade: 0 }],
      sessions: [{ sessionId: "s", queryText: "q", shownItemIds: [], clickedItemIds: [] }],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: () => [1, 0, 0, 0, 0, 0],
      chapters: CHAPTERS,
    });
    expect(lesson.logExamples).toEqual([]);
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given ties, When the lesson is built, Then ranking falls back to the id", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 0),
      judgments: [
        { queryText: "q", itemId: "zebra", grade: 0 },
        { queryText: "q", itemId: "apple", grade: 0 },
      ],
      sessions: [
        {
          sessionId: "s",
          queryText: "q",
          shownItemIds: ["zebra", "apple"],
          clickedItemIds: [],
        },
      ],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: () => [1, 0, 0, 0, 0, 0],
      chapters: CHAPTERS,
    });
    expect(lesson.logExamples[0]?.items.map((item) => item.itemId)).toEqual(["zebra", "apple"]);
    expect(lesson.clickedBaitExamples).toEqual([]);
  });

  it("Given two queries, When the lesson is built, Then NDCG is the mean over queries", () => {
    const lesson = buildBiasLesson({
      naive: model("naive", 0),
      corrected: model("corrected", 0),
      judgments: [
        { queryText: "q1", itemId: "good", grade: 3 },
        { queryText: "q1", itemId: "bait", grade: 0 },
        { queryText: "q2", itemId: "bait", grade: 3 },
        { queryText: "q2", itemId: "good", grade: 0 },
      ],
      sessions: [],
      propensity: { estimatedDecay: [1], trueDecay: [1] },
      featuresFor: (_queryText, itemId) =>
        itemId === "good" ? [1, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0],
      chapters: CHAPTERS,
    });
    expect(lesson.queryCount).toBe(2);
    expect(lesson.naive.ndcgAt10).toBeCloseTo((1 + 1 / Math.log2(3)) / 2, 8);
    expect(lesson.corrected.ndcgAt10).toBeCloseTo((1 + 1 / Math.log2(3)) / 2, 8);
  });
});
