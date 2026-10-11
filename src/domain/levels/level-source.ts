import { readModuleSource } from "../code/module-registry.ts";
import { UseCaseError } from "../search/errors.ts";
import type { EvolutionLevel } from "../types/level.ts";
import { findCompositionPoint } from "./composition-point.ts";
import { requireImplementedLevel } from "./require-level.ts";

export const RANKER_EXPORT_SYMBOL = "createRanker";

export interface LevelSourceView {
  readonly sourcePath: string;
  readonly source: string;
  readonly lineCount: number;
  readonly composesLevelId: string | null;
  readonly compositionPointLine: number | null;
}

export function rawSourceFor(sourceSpecifier: string): string {
  return readModuleSource(sourceSpecifier);
}

export function resolveLevelSource(
  levelId: string,
  levels: readonly EvolutionLevel[],
): LevelSourceView {
  const level = requireImplementedLevel(levels, levelId);
  const source = rawSourceFor(level.sourceSpecifier);
  if (!source.includes(`export function ${RANKER_EXPORT_SYMBOL}`)) {
    throw new UseCaseError(
      "BAD_REQUEST",
      `${level.id} display source does not export ${RANKER_EXPORT_SYMBOL}.`,
    );
  }
  const composition = findCompositionPoint(source);
  return {
    sourcePath: level.sourceSpecifier,
    source,
    lineCount: countLines(source),
    composesLevelId: composition.composesLevelId,
    compositionPointLine: composition.compositionPointLine,
  };
}

function countLines(source: string): number {
  if (source.length === 0) {
    return 0;
  }
  const parts = source.split("\n");
  const last = parts.at(-1);
  if (last === "") {
    return parts.length - 1;
  }
  return parts.length;
}
