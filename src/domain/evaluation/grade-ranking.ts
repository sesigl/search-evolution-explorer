import { compareScoreThenId } from "../sort-score.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { RankedResult } from "../types/ranking.ts";
import { ndcgAt } from "./ndcg.ts";

const K = 10;

export interface GradedRow {
  readonly itemId: string;
  readonly title: string;
  readonly position: number;
  /** 0 when the judgment set has no grade for this listing. */
  readonly grade: number;
  /** Contribution of this row to the score before normalisation: (2^grade - 1) / log2(position + 1). */
  readonly gain: number;
}

export interface GradedRanking {
  readonly queryText: string;
  readonly levelId: string;
  readonly rows: readonly GradedRow[];
  readonly ideal: readonly GradedRow[];
  readonly ndcgAt10: number;
  readonly judgedCount: number;
  /** Judged listings with a grade above 0 that did not appear in the top K. */
  readonly missedCount: number;
}

/**
 * Grades one ranking against the judgments for its query so a learner can see where the
 * NDCG number comes from: which rows earned gain, which earned nothing, and what the best
 * possible order would have been.
 */
export function gradeRanking(
  queryText: string,
  levelId: string,
  results: readonly RankedResult[],
  judgments: readonly Judgment[],
  titleOf: (itemId: string) => string,
): GradedRanking {
  const grades = new Map<string, number>();
  for (const judgment of judgments) {
    if (judgment.queryText === queryText) {
      grades.set(judgment.itemId, judgment.grade);
    }
  }
  const top = results.slice(0, K);
  const rows = top.map((result, index) =>
    toRow(result.item.id, result.item.title, index + 1, grades.get(result.item.id) ?? 0),
  );
  const ideal = [...grades.entries()]
    .sort(compareScoreThenId)
    .slice(0, K)
    .map(([itemId, grade], index) => toRow(itemId, titleOf(itemId), index + 1, grade));
  const shown = new Set(top.map((result) => result.item.id));
  let missedCount = 0;
  for (const [itemId, grade] of grades) {
    if (grade > 0 && !shown.has(itemId)) {
      missedCount += 1;
    }
  }
  return {
    queryText,
    levelId,
    rows,
    ideal,
    ndcgAt10: ndcgAt(
      results.map((result) => result.item.id),
      grades,
      K,
    ),
    judgedCount: grades.size,
    missedCount,
  };
}

function toRow(itemId: string, title: string, position: number, grade: number): GradedRow {
  return {
    itemId,
    title,
    position,
    grade,
    gain: (2 ** grade - 1) / Math.log2(position + 1),
  };
}
