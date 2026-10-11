import { describe, expect, it } from "vitest";
import type { Judgment } from "../types/evaluation.ts";
import type { RankedResult } from "../types/ranking.ts";
import { gradeRanking } from "./grade-ranking.ts";

function result(id: string, position: number): RankedResult {
  return {
    item: {
      id,
      title: `Title ${id}`,
      description: "",
      categoryId: "c",
      priceCents: 100,
      location: "x",
      postedAt: "2026-01-01T00:00:00.000Z",
      available: true,
    } as RankedResult["item"],
    position,
    score: 1,
    signals: [],
  };
}

const judgments: Judgment[] = [
  { queryText: "sofa", itemId: "a", grade: 3 },
  { queryText: "sofa", itemId: "b", grade: 1 },
  { queryText: "sofa", itemId: "c", grade: 2 },
  { queryText: "other", itemId: "z", grade: 3 },
];

describe("gradeRanking", () => {
  it("grades the shown rows, builds the ideal order, and counts missed judged listings", () => {
    const graded = gradeRanking(
      "sofa",
      "level-1-lexical",
      [result("b", 1), result("a", 2), result("x", 3)],
      judgments,
      (id) => `Title ${id}`,
    );
    expect(graded.rows.map((row) => row.grade)).toEqual([1, 3, 0]);
    expect(graded.rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(graded.ideal.map((row) => row.itemId)).toEqual(["a", "c", "b"]);
    expect(graded.ideal.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(graded.ideal.map((row) => row.title)).toEqual(["Title a", "Title c", "Title b"]);
    expect(graded.judgedCount).toBe(3);
    expect(graded.missedCount).toBe(1);
    expect(graded.ndcgAt10).toBeGreaterThan(0);
    expect(graded.ndcgAt10).toBeLessThan(1);
  });

  it("scores 1 when the ranking equals the ideal order", () => {
    const graded = gradeRanking(
      "sofa",
      "level-1-lexical",
      [result("a", 1), result("c", 2), result("b", 3)],
      judgments,
      (id) => id,
    );
    expect(graded.ndcgAt10).toBe(1);
    expect(graded.rows[0]?.gain).toBe(7);
  });

  it("computes each row's gain as (2^grade - 1) / log2(position + 1)", () => {
    const graded = gradeRanking(
      "sofa",
      "level-1-lexical",
      [result("b", 1), result("a", 2)],
      judgments,
      (id) => id,
    );
    expect(graded.rows[0]?.gain).toBe(1 / Math.log2(2));
    expect(graded.rows[1]?.gain).toBe(7 / Math.log2(3));
  });

  it("keeps only the top ten rows and the top ten ideal rows", () => {
    const twelve = Array.from({ length: 12 }, (_, index) => result(`i${index}`, index + 1));
    const twelveJudgments: Judgment[] = twelve.map((_, index) => ({
      queryText: "q",
      itemId: `i${index}`,
      grade: (index % 4) as 0 | 1 | 2 | 3,
    }));
    const graded = gradeRanking("q", "level-1-lexical", twelve, twelveJudgments, (id) => id);
    expect(graded.rows).toHaveLength(10);
    expect(graded.ideal).toHaveLength(10);
    expect(graded.rows.at(-1)?.position).toBe(10);
    expect(graded.judgedCount).toBe(12);
    expect(graded.missedCount).toBe(2);
  });

  it("does not count a judged listing with grade 0 as missed", () => {
    const graded = gradeRanking(
      "sofa",
      "level-1-lexical",
      [result("a", 1)],
      [...judgments, { queryText: "sofa", itemId: "irrelevant", grade: 0 }],
      (id) => id,
    );
    expect(graded.judgedCount).toBe(4);
    expect(graded.missedCount).toBe(2);
  });
});
