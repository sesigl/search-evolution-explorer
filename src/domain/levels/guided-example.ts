import type { EvolutionLevel } from "../types/level.ts";

/** The only part of a ranked result this check reads: the listing id. */
export interface IdentifiedResult {
  readonly item: { readonly id: string };
}

export function evaluateGuidedExample(
  assertion: EvolutionLevel["guidedExamples"][number]["assertion"],
  target: string | null,
  current: readonly IdentifiedResult[],
  previous: readonly IdentifiedResult[],
): boolean {
  const currentIds = current.slice(0, 10).map((result) => result.item.id);
  const previousIds = previous.slice(0, 10).map((result) => result.item.id);
  if (assertion === "itemEnters") {
    return target !== null && currentIds.includes(target) && !previousIds.includes(target);
  }
  if (assertion === "itemExits") {
    return target !== null && previousIds.includes(target) && !currentIds.includes(target);
  }
  if (target === null) {
    return currentIds.join("\0") !== previousIds.join("\0");
  }
  return currentIds.indexOf(target) !== previousIds.indexOf(target);
}

export function examplesForLevel(level: EvolutionLevel): EvolutionLevel["guidedExamples"] {
  return level.guidedExamples;
}
