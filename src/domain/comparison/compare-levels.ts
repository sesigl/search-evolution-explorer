import { UseCaseError } from "../search/errors.ts";
import {
  runSearch,
  type SearchDeps,
  type SearchInput,
  type SearchOutput,
} from "../search/run-search.ts";
import { compareRankings, type LevelComparison } from "./compare.ts";
import { suggestDistinguishingQuery } from "./suggest-query.ts";

export interface CompareInput {
  readonly queryText: string;
  readonly leftLevelId: string;
  readonly rightLevelId: string;
  readonly limit?: number;
  readonly queryVector?: Float32Array;
}

export interface CompareOutput extends LevelComparison {
  readonly left: SearchOutput;
  readonly right: SearchOutput;
  readonly membershipKind: "matching" | "scoring";
  readonly suggestedDistinguishingQuery: string | null;
}

export async function compareLevels(input: CompareInput, deps: SearchDeps): Promise<CompareOutput> {
  if (input.leftLevelId === input.rightLevelId) {
    throw new UseCaseError("BAD_REQUEST", "Comparison requires two different levels.");
  }
  const left = await runSearch(
    searchInput(input.queryText, input.leftLevelId, input.limit, input.queryVector),
    deps,
  );
  const right = await runSearch(
    searchInput(input.queryText, input.rightLevelId, input.limit, input.queryVector),
    deps,
  );
  const membershipKind = membershipKindFor(left, right);
  const diff = compareRankings(left.results, right.results, membershipKind);
  return {
    left,
    right,
    membershipKind,
    ...diff,
    suggestedDistinguishingQuery: diff.identical
      ? suggestDistinguishingQuery(input.leftLevelId, input.rightLevelId)
      : null,
  };
}

function membershipKindFor(left: SearchOutput, right: SearchOutput): "matching" | "scoring" {
  const higher = left.level.ordinal > right.level.ordinal ? left.level : right.level;
  if (Math.abs(left.level.ordinal - right.level.ordinal) === 1 && higher.changes === "scoring") {
    return "scoring";
  }
  if (left.candidateWidth === right.candidateWidth) {
    return "scoring";
  }
  return "matching";
}

function searchInput(
  queryText: string,
  levelId: string,
  limit: number | undefined,
  queryVector: Float32Array | undefined,
): SearchInput {
  return {
    queryText,
    levelId,
    ...(limit === undefined ? {} : { limit }),
    ...(queryVector === undefined ? {} : { queryVector }),
  };
}
