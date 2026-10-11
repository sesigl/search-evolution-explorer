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
