import { examplesForLevel } from "../domain/levels/guided-example.ts";
import { levels } from "../domain/levels/level-registry.ts";
import { requireLevel } from "../domain/levels/require-level.ts";

export function handleGetGuidedExample(input: { levelId: string }) {
  const level = requireLevel(levels, input.levelId);
  const previous = levels.find((entry) => entry.ordinal === level.ordinal - 1);
  return {
    examples: examplesForLevel(level).map((example) => ({
      queryText: example.queryText,
      expectedDifference: example.expectedDifference,
      comparedWithLevelId: previous?.id ?? level.id,
      comparedWithOrdinal: previous?.ordinal ?? null,
      assertion: example.assertion,
      assertionTarget: example.assertionTarget,
    })),
  };
}
