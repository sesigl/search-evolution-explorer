import type { Judgment } from "../types/evaluation.ts";

export function uniqueQueryTexts(judgments: readonly Judgment[]): string[] {
  return [...new Set(judgments.map((judgment) => judgment.queryText))];
}
