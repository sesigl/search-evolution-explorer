import { createApp } from "../di.ts";
import type { GradedRanking } from "../domain/evaluation/grade-ranking.ts";

export type { GradedRanking, GradedRow } from "../domain/evaluation/grade-ranking.ts";

/** Judged queries a learner can read without context: the ones the book evaluates on. */
export async function handleListTeachingQueries(): Promise<string[]> {
  const app = await createApp();
  return app.listJudgedQueries();
}

export async function handleGradeQuery(input: {
  queryText: string;
  levelId: string;
}): Promise<GradedRanking> {
  const app = await createApp();
  return app.gradeQuery(input.queryText, input.levelId);
}
