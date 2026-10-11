import type { EvolutionLevel } from "../types/level.ts";

/**
 * The chapters a scorecard can run: every implemented level that has a ranker, plus the
 * evaluation introduction, which has no ranker but sets the baseline. In ladder order.
 */
export function readyLevels(
  levels: readonly EvolutionLevel[],
  hasRanker: (levelId: string) => boolean,
): EvolutionLevel[] {
  return levels
    .filter((level) => level.implemented && (level.ordinal === 0 || hasRanker(level.id)))
    .sort((left, right) => left.ordinal - right.ordinal);
}
