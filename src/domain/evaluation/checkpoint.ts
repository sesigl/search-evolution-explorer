import type { Scorecard } from "../types/evaluation.ts";
import type { EvolutionLevel } from "../types/level.ts";

/** One runnable chapter and its average score, for the small ladder in the checkpoint. */
interface CheckpointRung {
  readonly levelId: string;
  readonly ordinal: number;
  readonly label: string;
  readonly ndcgAt10: number;
  /** Test queries where at least one relevant listing reached the top 10. */
  readonly foundCount: number;
}

/** The score of the current query at this chapter and at the chapter before it. */
interface CheckpointQuery {
  readonly queryText: string;
  readonly ndcgAt10: number;
  readonly previousNdcgAt10: number | null;
}

/**
 * The end of a chapter: did this chapter make search better? The scorecard already has the
 * answer over every test query; the checkpoint reads out the part that concerns one chapter.
 */
export interface Checkpoint {
  readonly levelId: string;
  readonly ordinal: number;
  readonly ndcgAt10: number;
  readonly previous: CheckpointRung | null;
  readonly rungs: readonly CheckpointRung[];
  readonly queryCount: number;
  /** Test queries where this chapter scored below the chapter before it. */
  readonly regressionCount: number;
  /** The test query with the largest drop against the chapter before, or null when none dropped. */
  readonly worstRegression: { readonly queryText: string; readonly delta: number } | null;
  /** Null when the current query is not in the answer key. */
  readonly forQuery: CheckpointQuery | null;
  /** The same chapter measured on held-out query groups, when available (the split chapter 10's towers never trained on). */
  readonly heldOut: { readonly ndcgAt10: number; readonly queryCount: number } | null;
}

export function checkpointFor(
  scorecard: Scorecard,
  levels: readonly EvolutionLevel[],
  levelId: string,
  queryText: string,
): Checkpoint | null {
  const rungs = scorecard.runs.flatMap((run) => {
    const level = levels.find((entry) => entry.id === run.levelId);
    return level === undefined || level.ordinal === 0
      ? []
      : [
          {
            levelId: run.levelId,
            ordinal: level.ordinal,
            label: level.label,
            ndcgAt10: run.ndcgAt10,
            foundCount: run.perQuery.filter((row) => row.ndcgAt10 > 0).length,
          },
        ];
  });
  const index = rungs.findIndex((rung) => rung.levelId === levelId);
  const rung = rungs[index];
  if (rung === undefined) {
    return null;
  }
  const previous = rungs[index - 1] ?? null;
  const run = scorecard.runs.find((entry) => entry.levelId === levelId);
  const regressions = scorecard.regressions.filter((entry) => entry.levelId === levelId);
  const row = run?.perQuery.find((entry) => entry.queryText === queryText);
  const previousRow = scorecard.runs
    .find((entry) => entry.levelId === previous?.levelId)
    ?.perQuery.find((entry) => entry.queryText === queryText);
  const heldOutRun = scorecard.heldOut?.runs.find((entry) => entry.levelId === levelId);
  return {
    levelId,
    ordinal: rung.ordinal,
    ndcgAt10: rung.ndcgAt10,
    previous,
    rungs,
    queryCount: run?.perQuery.length ?? 0,
    regressionCount: regressions.length,
    worstRegression: regressions.reduce<{ queryText: string; delta: number } | null>(
      (worst, entry) =>
        worst === null || entry.delta < worst.delta
          ? { queryText: entry.queryText, delta: entry.delta }
          : worst,
      null,
    ),
    forQuery:
      row === undefined
        ? null
        : {
            queryText,
            ndcgAt10: row.ndcgAt10,
            previousNdcgAt10: previousRow?.ndcgAt10 ?? null,
          },
    heldOut:
      heldOutRun === undefined
        ? null
        : { ndcgAt10: heldOutRun.ndcgAt10, queryCount: heldOutRun.perQuery.length },
  };
}
