import { readyLevels } from "../levels/ready-levels.ts";
import { requireLevel } from "../levels/require-level.ts";
import { queryTextForEncoding } from "../query-understanding/understand.ts";
import { UseCaseError } from "../search/errors.ts";
import { runSearch, type SearchDeps } from "../search/run-search.ts";
import type { Judgment, Scorecard, ScorecardQueryRow, ScorecardRun } from "../types/evaluation.ts";
import type { EvolutionLevel } from "../types/level.ts";
import { mrr } from "./mrr.ts";
import { ndcgAt } from "./ndcg.ts";
import { recallAt } from "./recall.ts";
import { uniqueQueryTexts } from "./unique-query-texts.ts";

const NDCG_K = 10;
const RECALL_K = 50;
const SEARCH_LIMIT = 50;

export const WANDS_GROUND_TRUTH_DISCLOSURE =
  "Ground truth is the WANDS human relevance labels: Exact = 3, Partial = 1, Irrelevant = 0, over the evaluated queries. The labels come from human annotators, not clicks. The click log used by the learned and bias chapters is simulated from those grades times a position decay. Price and date are deterministic synthetic overlay columns because WANDS has neither.";

export async function assembleScorecard(
  requestedLevelIds: readonly string[] | undefined,
  judgments: readonly Judgment[],
  deps: SearchDeps,
  queryVectors: ReadonlyMap<string, Float32Array> = new Map(),
  testQueries?: ReadonlySet<string>,
): Promise<Scorecard> {
  if (judgments.length === 0) {
    throw new UseCaseError(
      "PRECONDITION_FAILED",
      "Judgments are missing. Rebuild with npm run data:clicks.",
    );
  }
  const levelIds = resolveLevelIds(requestedLevelIds, deps.levels, deps.rankers);
  const queries = uniqueQueries(judgments);
  const gradesByQuery = groupGrades(judgments);
  const relevantByQuery = groupRelevant(judgments);
  const measured = new Map<string, ScorecardRun[]>();
  const regressions: Scorecard["regressions"][number][] = [];
  for (const query of queries) {
    let previousNdcg = new Map<string, number>();
    for (const [levelIndex, levelId] of levelIds.entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: adjacent chapters reuse this query's joint inference
      const evaluated = await evaluateLevel(
        levelId,
        [query],
        gradesByQuery,
        relevantByQuery,
        previousNdcg,
        levelIndex === 0,
        deps,
        queryVectors,
      );
      const rows = measured.get(levelId) ?? [];
      rows.push(evaluated.run);
      measured.set(levelId, rows);
      regressions.push(...evaluated.regressions);
      previousNdcg = evaluated.ndcgByQuery;
    }
  }
  const runs = [...measured.entries()].map(([id, rows]) => combineQueryRuns(id, rows));
  if (testQueries === undefined) {
    return { runs, regressions };
  }
  const isTest = (text: string) => testQueries.has(queryTextForEncoding(text));
  const heldOut = {
    runs: [...measured.entries()].map(([id, rows]) =>
      combineQueryRuns(
        id,
        rows.filter((row) => isTest(row.perQuery[0]?.queryText ?? "")),
      ),
    ),
    regressions: regressions.filter((row) => isTest(row.queryText)),
  };
  return { runs, regressions, heldOut };
}

function combineQueryRuns(levelId: string, rows: readonly ScorecardRun[]): ScorecardRun {
  const count = Math.max(rows.length, 1);
  const times = rows.map((row) => row.msPerQueryP50).sort((a, b) => a - b);
  return {
    levelId,
    ndcgAt10: rows.reduce((sum, row) => sum + row.ndcgAt10, 0) / count,
    mrr: rows.reduce((sum, row) => sum + row.mrr, 0) / count,
    recallAt50: rows.reduce((sum, row) => sum + row.recallAt50, 0) / count,
    msPerQueryP50: percentile(times, 50),
    msPerQueryP95: percentile(times, 95),
    perQuery: rows.flatMap((row) => row.perQuery),
    groundTruthDisclosure: WANDS_GROUND_TRUTH_DISCLOSURE,
  };
}

async function evaluateLevel(
  levelId: string,
  queries: readonly string[],
  gradesByQuery: ReadonlyMap<string, ReadonlyMap<string, number>>,
  relevantByQuery: ReadonlyMap<string, ReadonlySet<string>>,
  previousNdcg: ReadonlyMap<string, number>,
  isFirstLevel: boolean,
  deps: SearchDeps,
  queryVectors: ReadonlyMap<string, Float32Array>,
): Promise<{
  run: ScorecardRun;
  regressions: Scorecard["regressions"][number][];
  ndcgByQuery: Map<string, number>;
}> {
  const perQuery: ScorecardQueryRow[] = [];
  const times: number[] = [];
  const ndcgByQuery = new Map<string, number>();
  const regressions: Scorecard["regressions"][number][] = [];
  let ndcgSum = 0;
  let mrrSum = 0;
  let recallSum = 0;
  for (const queryText of queries) {
    const queryVector = queryVectors.get(queryText);
    // biome-ignore lint/performance/noAwaitInLoops: serial inference gives comparable latency per query
    const output = await runSearch(
      queryVector === undefined
        ? { queryText, levelId, limit: SEARCH_LIMIT }
        : { queryText, levelId, limit: SEARCH_LIMIT, queryVector },
      deps,
    );
    const rankedIds = output.results.map((result) => result.item.id);
    const grades = gradesByQuery.get(queryText) ?? new Map();
    const relevant = relevantByQuery.get(queryText) ?? new Set();
    const ndcg = ndcgAt(rankedIds, grades, NDCG_K);
    const delta = isFirstLevel ? 0 : ndcg - (previousNdcg.get(queryText) ?? 0);
    perQuery.push({ queryText, ndcgAt10: ndcg, deltaVsPreviousLevel: delta });
    ndcgByQuery.set(queryText, ndcg);
    times.push(output.elapsedMs);
    ndcgSum += ndcg;
    mrrSum += mrr(rankedIds, relevant);
    recallSum += recallAt(rankedIds, relevant, RECALL_K);
    if (delta < 0) {
      regressions.push({ levelId, queryText, delta });
    }
  }
  const count = Math.max(queries.length, 1);
  times.sort((left, right) => left - right);
  return {
    run: {
      levelId,
      ndcgAt10: ndcgSum / count,
      mrr: mrrSum / count,
      recallAt50: recallSum / count,
      msPerQueryP50: percentile(times, 50),
      msPerQueryP95: percentile(times, 95),
      perQuery,
      groundTruthDisclosure: WANDS_GROUND_TRUTH_DISCLOSURE,
    },
    regressions,
    ndcgByQuery,
  };
}

function resolveLevelIds(
  requestedLevelIds: readonly string[] | undefined,
  levels: readonly EvolutionLevel[],
  rankers: SearchDeps["rankers"],
): string[] {
  if (requestedLevelIds === undefined || requestedLevelIds.length === 0) {
    return readyLevels(levels, (levelId) => rankers.has(levelId)).map((level) => level.id);
  }
  for (const levelId of requestedLevelIds) {
    requireLevel(levels, levelId);
  }
  return [...requestedLevelIds];
}

function uniqueQueries(judgments: readonly Judgment[]): string[] {
  return uniqueQueryTexts(judgments).sort((left, right) => left.localeCompare(right));
}

function groupGrades(judgments: readonly Judgment[]): Map<string, Map<string, number>> {
  const grouped = new Map<string, Map<string, number>>();
  for (const judgment of judgments) {
    const grades = grouped.get(judgment.queryText) ?? new Map<string, number>();
    grades.set(judgment.itemId, judgment.grade);
    grouped.set(judgment.queryText, grades);
  }
  return grouped;
}

function groupRelevant(judgments: readonly Judgment[]): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>();
  for (const judgment of judgments) {
    if (judgment.grade > 0) {
      const ids = grouped.get(judgment.queryText) ?? new Set<string>();
      ids.add(judgment.itemId);
      grouped.set(judgment.queryText, ids);
    }
  }
  return grouped;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)));
  return sorted[index] ?? 0;
}
