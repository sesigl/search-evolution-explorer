import { level0Content } from "../../content/levels/level-0.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";

export const meta: EvolutionLevel = {
  id: "level-0-evaluation",
  ordinal: 0,
  label: "Evaluation",
  capability: "Measure ranking quality with a judgment set before you change the ranker.",
  changes: "scoring",
  mechanism: level0Content.mechanism,
  tradeOff: level0Content.tradeOff,
  fixesFailureMode: null,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-0-evaluation.ts",
  implemented: true,
  guidedExamples: [],
  candidateWidth: 0,
};

export function createRanker(_deps: LevelDeps): LevelRanker {
  return {
    match() {
      return { items: [] };
    },
    score(_understanding, candidate) {
      return { item: candidate, score: 0, signals: [] };
    },
  };
}
