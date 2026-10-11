import { UseCaseError } from "../search/errors.ts";
import type { EvolutionLevel } from "../types/level.ts";

export function requireLevel(levels: readonly EvolutionLevel[], levelId: string): EvolutionLevel {
  const level = levels.find((entry) => entry.id === levelId);
  if (level === undefined) {
    throw new UseCaseError("BAD_REQUEST", `Unknown level: ${levelId}`);
  }
  return level;
}

export function requireImplementedLevel(
  levels: readonly EvolutionLevel[],
  levelId: string,
): EvolutionLevel {
  const level = requireLevel(levels, levelId);
  if (!level.implemented) {
    throw new UseCaseError(
      "BAD_REQUEST",
      `${level.label} is a labelled forward preview and is not available yet.`,
    );
  }
  return level;
}
