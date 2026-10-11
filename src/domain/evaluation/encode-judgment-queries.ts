import type { QueryEncoder } from "../ports/query-encoder.ts";
import { queryTextForEncoding } from "../query-understanding/understand.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { AsyncLevelRanker, LevelRanker } from "../types/level.ts";
import { uniqueQueryTexts } from "./unique-query-texts.ts";

export async function encodeJudgmentQueries(
  encoder: QueryEncoder | undefined,
  judgments: readonly Judgment[],
  rankers: ReadonlyMap<string, LevelRanker | AsyncLevelRanker>,
): Promise<ReadonlyMap<string, Float32Array>> {
  if (
    encoder === undefined ||
    !(rankers.has("level-4-hybrid") || rankers.has("level-5-cross-encoder"))
  ) {
    return new Map();
  }
  const queries = uniqueQueryTexts(judgments);
  const encoded = await Promise.all(
    queries.map(async (queryText) => {
      const vector = await encoder.encode(queryTextForEncoding(queryText));
      return [queryText, vector] as const;
    }),
  );
  return new Map(encoded);
}
