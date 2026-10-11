import { requireImplementedLevel } from "../levels/require-level.ts";
import type { Clock } from "../ports/clock.ts";
import type { EntityConcept } from "../query-understanding/entities.ts";
import { understand } from "../query-understanding/understand.ts";
import { compareScoreThenId } from "../sort-score.ts";
import type { Category } from "../types/corpus.ts";
import type {
  AsyncLevelRanker,
  EvolutionLevel,
  EvolutionLevelSummary,
  LevelRanker,
} from "../types/level.ts";
import type { LeverConfiguration, LeverOverrides, SpellingCorrection } from "../types/query.ts";
import type { RankedResult } from "../types/ranking.ts";
import { UseCaseError } from "./errors.ts";

const MAX_QUERY_LENGTH = 200;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export interface SearchInput {
  readonly queryText: string;
  readonly levelId: string;
  readonly leverOverrides?: LeverOverrides | undefined;
  readonly limit?: number | undefined;
  /** 0-based index of the first result. Pagination; the full match set is still scored. */
  readonly offset?: number | undefined;
  readonly queryVector?: Float32Array | undefined;
}

export interface SearchOutput {
  readonly results: RankedResult[];
  readonly understanding: ReturnType<typeof understand>;
  readonly candidateWidth: number;
  readonly elapsedMs: number;
  readonly level: EvolutionLevelSummary;
  /** Spelling fixes the running level applied before lookup; empty for word-literal levels. */
  readonly appliedCorrections: readonly SpellingCorrection[];
  /** Ontology concepts the running level enforced; empty for word-only levels. */
  readonly concepts: readonly EntityConcept[];
}

export interface SearchDeps {
  readonly levels: readonly EvolutionLevel[];
  readonly rankers: ReadonlyMap<string, LevelRanker | AsyncLevelRanker>;
  readonly levers: LeverConfiguration;
  readonly clock: Clock;
  readonly categories: readonly Category[];
}

export async function runSearch(input: SearchInput, deps: SearchDeps): Promise<SearchOutput> {
  const queryText = input.queryText.trim();
  if (queryText === "" || queryText.length > MAX_QUERY_LENGTH) {
    throw new UseCaseError(
      "BAD_REQUEST",
      "Query text must be between 1 and 200 characters after trim.",
    );
  }
  const level = requireImplementedLevel(deps.levels, input.levelId);
  const ranker = deps.rankers.get(level.id);
  const started = deps.clock.now();
  const overrides = input.leverOverrides ?? {};
  const understood = understand(queryText, deps.levers, overrides, deps.categories);
  const understanding =
    input.queryVector === undefined
      ? understood
      : { ...understood, queryVector: input.queryVector };
  if (ranker === undefined) {
    const rebuild = level.prerequisites[0]?.buildCommand;
    if (rebuild !== undefined) {
      throw new UseCaseError(
        "PRECONDITION_FAILED",
        `This level is missing a required artifact. Rebuild with ${rebuild}.`,
      );
    }
    const finished = deps.clock.now();
    return {
      results: [],
      understanding,
      candidateWidth: 0,
      elapsedMs: Math.max(0, finished.getTime() - started.getTime()),
      level: summarize(level),
      appliedCorrections: [],
      concepts: [],
    };
  }
  const limit = resolveLimit(input.limit);
  const offset = resolveOffset(input.offset);
  const candidates = await ranker.match(understanding);
  const scored = candidates.items.map((item) => ranker.score(understanding, item));
  scored.sort((left, right) =>
    compareScoreThenId([left.item.id, left.score], [right.item.id, right.score]),
  );
  const limited = scored.slice(offset, offset + limit);
  const results: RankedResult[] = limited.map((entry, index) => ({
    item: entry.item,
    position: offset + index + 1,
    score: entry.score,
    signals: entry.signals,
  }));
  const finished = deps.clock.now();
  return {
    results,
    understanding,
    candidateWidth: candidates.items.length,
    elapsedMs: Math.max(0, finished.getTime() - started.getTime()),
    level: summarize(level),
    appliedCorrections: ranker.correctionsFor?.(understanding) ?? [],
    concepts: ranker.conceptsFor?.(understanding) ?? [],
  };
}

function summarize(level: EvolutionLevel): EvolutionLevelSummary {
  return {
    id: level.id,
    ordinal: level.ordinal,
    label: level.label,
    capability: level.capability,
    changes: level.changes,
    mechanism: level.mechanism,
    tradeOff: level.tradeOff,
    fixesFailureMode: level.fixesFailureMode,
  };
}

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new UseCaseError("BAD_REQUEST", "Result limit must be between 1 and 50.");
  }
  return limit;
}

function resolveOffset(offset: number | undefined): number {
  if (offset === undefined) {
    return 0;
  }
  if (offset < 0 || !Number.isInteger(offset)) {
    throw new UseCaseError("BAD_REQUEST", "Result offset must be a whole number of 0 or more.");
  }
  return offset;
}
