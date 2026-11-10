import { existsSync, readFileSync } from "node:fs";
import type { BiasLesson } from "../domain/ranking/bias-lesson.ts";
import type { Scorecard } from "../domain/types/evaluation.ts";

export const PRECOMPUTED_RESULTS_PATH = "data/precomputed/results.json";

/**
 * Results that take too long to compute inside one serverless request. The fingerprint names
 * the source code, data files and ready levels they were computed from.
 */
export interface PrecomputedResults {
  readonly fingerprint: string;
  readonly fullScorecard: Scorecard;
  readonly earlyScorecard: Scorecard;
  readonly biasLesson: BiasLesson;
}

export function readPrecomputedResults(path: string): PrecomputedResults | undefined {
  if (!existsSync(path)) {
    return;
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isPrecomputedResults(parsed)) {
    throw new Error(`Malformed precomputed results in ${path}.`);
  }
  return parsed;
}

/** A report is measured offline; model availability on the hosting machine cannot invalidate it. */
export function selectPrecomputedResults(
  results: PrecomputedResults | undefined,
  fingerprintFor: (levelIds: readonly string[]) => string,
  allowLiveEvaluation: boolean,
): PrecomputedResults | undefined {
  // The introduction has an evaluation row but no serving ranker.
  const levelIds =
    results?.fullScorecard.runs
      .map((run) => run.levelId)
      .filter((id) => id !== "level-0-evaluation") ?? [];
  if (results !== undefined && results.fingerprint === fingerprintFor(levelIds)) return results;
  if (!allowLiveEvaluation) {
    throw new Error(
      "Reports are missing or stale. Run npm run data:precompute locally and commit the results before building.",
    );
  }
  return undefined;
}

function isPrecomputedResults(value: unknown): value is PrecomputedResults {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["fingerprint"] === "string" &&
    hasRuns(record["fullScorecard"]) &&
    hasRuns(record["earlyScorecard"]) &&
    typeof record["biasLesson"] === "object" &&
    record["biasLesson"] !== null
  );
}

function hasRuns(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)["runs"])
  );
}
