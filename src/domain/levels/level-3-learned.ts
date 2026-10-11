import { level3Content } from "../../content/levels/level-3.ts";
import type { Clock } from "../ports/clock.ts";
import { extractFeatures, FEATURE_NAMES } from "../ranking/features.ts";
import { linearScore } from "../ranking/linear-scorer.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { freezeClock } from "../signals/frozen-clock.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { createRanker as createPrevious } from "./level-2-boosting.ts";

export const meta: EvolutionLevel = {
  id: "level-3-learned",
  ordinal: 8,
  label: "Learned ranking",
  capability: "Replace hand-tuned boosts with a linear model trained from chapter 7 clicks.",
  changes: "scoring",
  mechanism: level3Content.mechanism,
  tradeOff: level3Content.tradeOff,
  fixesFailureMode: level3Content.fixesFailureMode,
  prerequisites: [
    {
      kind: "model",
      artifactPath: "data/models/ranker-corrected.json",
      buildCommand: "npm run data:train",
    },
  ],
  sourceSpecifier: "src/domain/levels/level-3-learned.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "marble",
      expectedDifference:
        "The learned weights lift an 'oriental marble look tile' into the top 10 for 'marble'; the hand-tuned boosts left it outside.",
      assertion: "itemEnters",
      assertionTarget: "wands-33756",
    },
  ],
  candidateWidth: 5000,
};

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  // Recency depends on the time. One query reads the clock once, so two listings posted at
  // the same moment score exactly the same, and a millisecond tick while scoring the
  // candidates cannot change their order.
  const clockByQuery = new WeakMap<QueryUnderstanding, Clock>();
  return {
    match: previous.match,
    score(understanding, candidate) {
      const features = extractFeatures(understanding, candidate, {
        index: deps.index,
        levers: deps.levers,
        clock: frozenClock(understanding, deps.clock, clockByQuery),
      });
      // The model's bias (its intercept) is the same for every candidate, so it never changes the
      // order. It is left out of the reported score so the number a learner sees is the part that
      // actually moves listings, and it is not shown as a signal that is identical for every row.
      const learned =
        deps.model === undefined ? 0 : linearScore(deps.model, features) - deps.model.bias;
      const weights = deps.model?.weights ?? [];
      return {
        item: candidate,
        score: learned,
        signals: buildSignals(understanding, candidate, [
          { name: "learnedScore", value: learned },
          ...FEATURE_NAMES.map((name, index) => ({
            name,
            value: features[index] ?? 0,
            weight: weights[index],
          })),
        ]),
      };
    },
  };
}

function frozenClock(
  understanding: QueryUnderstanding,
  clock: Clock,
  cache: WeakMap<QueryUnderstanding, Clock>,
): Clock {
  const known = cache.get(understanding);
  if (known !== undefined) {
    return known;
  }
  const frozen = freezeClock(clock);
  cache.set(understanding, frozen);
  return frozen;
}
