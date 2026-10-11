import { ndcgAt } from "../evaluation/ndcg.ts";
import { uniqueQueryTexts } from "../evaluation/unique-query-texts.ts";
import type { SimulatedSession } from "../simulation/session-sampler.ts";
import { compareScoreThenId } from "../sort-score.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { TrainedRankingModel } from "../types/level.ts";
import { linearScore } from "./linear-scorer.ts";

export function judgmentsWithLogBait(
  judgments: readonly Judgment[],
  sessions: readonly SimulatedSession[],
): Judgment[] {
  const seen = new Set(judgments.map((row) => `${row.queryText}\0${row.itemId}`));
  const extra: Judgment[] = [];
  for (const session of sessions) {
    for (const itemId of session.shownItemIds) {
      const key = `${session.queryText}\0${itemId}`;
      if (!seen.has(key)) {
        seen.add(key);
        extra.push({ queryText: session.queryText, itemId, grade: 0 });
      }
    }
  }
  return extra.length === 0 ? [...judgments] : [...judgments, ...extra];
}

export function ndcgWithLogBait(
  model: TrainedRankingModel,
  judgments: readonly Judgment[],
  sessions: readonly SimulatedSession[],
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
): number {
  return ndcgOnJudgments(model, judgmentsWithLogBait(judgments, sessions), featuresFor);
}

export function ndcgOnJudgments(
  model: TrainedRankingModel,
  judgments: readonly Judgment[],
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
): number {
  const queries = uniqueQueryTexts(judgments);
  if (queries.length === 0) {
    return 0;
  }
  let total = 0;
  for (const queryText of queries) {
    const rows = judgments.filter((judgment) => judgment.queryText === queryText);
    const grades = new Map(rows.map((row) => [row.itemId, row.grade]));
    total += ndcgAt(rankByModel(model, queryText, grades, featuresFor), grades, 10);
  }
  return total / queries.length;
}

function rankByModel(
  model: TrainedRankingModel,
  queryText: string,
  grades: ReadonlyMap<string, number>,
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
): string[] {
  return [...grades.keys()]
    .flatMap((itemId) => {
      const features = featuresFor(queryText, itemId);
      return features === undefined ? [] : [{ id: itemId, score: linearScore(model, features) }];
    })
    .sort((left, right) => compareScoreThenId([left.id, left.score], [right.id, right.score]))
    .map((row) => row.id);
}
