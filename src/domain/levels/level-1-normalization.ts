import { levelNormalizationContent } from "../../content/levels/level-normalization.ts";
import { matchTermGroups } from "../index/inverted-index.ts";
import { understandingForMatching } from "../query-understanding/understand.ts";
import { termGroupsFor } from "../text/analyze-query.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import { createRanker as createPrevious } from "./level-1-recency.ts";

export const meta: EvolutionLevel = {
  id: "level-1-normalization",
  ordinal: 2,
  label: "Query normalization",
  capability:
    "Normalize query words with stemming, synonyms and spelling variants, still ordered newest first.",
  changes: "matching",
  mechanism: levelNormalizationContent.mechanism,
  tradeOff: levelNormalizationContent.tradeOff,
  fixesFailureMode: levelNormalizationContent.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-normalization.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "carpet",
      expectedDifference:
        "Synonym expansion widens chapter 1: the area rug enters the top 10 for 'carpet' although its title writes 'rug', not 'carpet'. The carpeted chair mat at rank 1 is the precision this recall costs.",
      assertion: "itemEnters",
      assertionTarget: "wands-4095",
    },
  ],
  candidateWidth: 5000,
};

/** Widen chapter 1 candidates with the recall levers; the order stays newest first. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  return {
    match(understanding) {
      previous.match(understanding);
      const matching = understandingForMatching(understanding);
      return matchTermGroups(deps.index, termGroupsFor(matching, deps.levers.synonymGroups));
    },
    score: (understanding, candidate) => previous.score(understanding, candidate),
  };
}
