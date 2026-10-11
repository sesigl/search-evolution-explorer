import { levelRecencyContent } from "../../content/levels/level-recency.ts";
import { understandingForMatching } from "../query-understanding/understand.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { freezeClock } from "../signals/frozen-clock.ts";
import { recencyScore } from "../signals/recency.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import { createRanker as createPrevious } from "./level-0-evaluation.ts";

export const meta: EvolutionLevel = {
  id: "level-1-recency",
  ordinal: 1,
  label: "Recency search",
  capability: "Retrieve strict word matches and order them newest first.",
  changes: "both",
  mechanism: levelRecencyContent.mechanism,
  tradeOff: levelRecencyContent.tradeOff,
  fixesFailureMode: levelRecencyContent.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-recency.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "sofa",
      expectedDifference:
        "The simplest search keeps the listings that write the query word and orders them newest first. This loveseat enters the top 10 because its text contains 'sofa' and it is recent; relevance does not enter the order.",
      assertion: "itemEnters",
      assertionTarget: "wands-1441",
    },
  ],
  candidateWidth: 5000,
};

/** Strict matching with newest-first order, kept readable on its own. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  // One query reads the clock once, so two listings posted at the same moment score exactly
  // the same and a millisecond tick cannot change their order between calls.
  const clock = freezeClock(deps.clock);
  return {
    match: (understanding) => strictCandidates(deps, previous, understanding),
    score: (understanding, candidate) => newestFirst(previous, clock, understanding, candidate),
  };
}

function strictCandidates(
  deps: LevelDeps,
  previous: LevelRanker,
  understanding: Parameters<LevelRanker["match"]>[0],
): ReturnType<LevelRanker["match"]> {
  previous.match(understanding);
  const matching = understandingForMatching(understanding);
  return deps.index.match(matching.tokens);
}

function newestFirst(
  previous: LevelRanker,
  clock: ReturnType<typeof freezeClock>,
  understanding: Parameters<LevelRanker["match"]>[0],
  candidate: Parameters<LevelRanker["score"]>[1],
): ReturnType<LevelRanker["score"]> {
  const base = previous.score(understanding, candidate);
  const value = recencyScore(candidate.postedAt, clock.now().getTime());
  return {
    item: candidate,
    score: base.score + value,
    signals: buildSignals(understanding, candidate, [{ name: "recency", value }]),
  };
}
