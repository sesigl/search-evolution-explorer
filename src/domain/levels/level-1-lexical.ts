import { level1Content } from "../../content/levels/level-1.ts";
import { bm25Score } from "../index/bm25.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import { createRanker as createPrevious } from "./level-1-normalization.ts";

export const meta: EvolutionLevel = {
  id: "level-1-lexical",
  ordinal: 3,
  label: "Lexical match",
  capability: "Order the normalized candidates by how strongly their text matches, with BM25.",
  changes: "scoring",
  mechanism: level1Content.mechanism,
  tradeOff: level1Content.tradeOff,
  fixesFailureMode: level1Content.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-lexical.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "sofa",
      expectedDifference:
        "BM25 reorders the chapter 2 candidates by text fit instead of age: the sofa-and-chaise with the strongest word match moves above fresher but weaker listings.",
      assertion: "rankChangeInTop10",
      assertionTarget: "wands-19037",
    },
  ],
  candidateWidth: 5000,
};

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  return {
    match: previous.match,
    score(understanding, candidate) {
      const base = previous.score(understanding, candidate);
      const value = bm25Score(
        understanding.expandedTokens,
        candidate,
        deps.index.documentCount,
        deps.index.averageLength,
        deps.index.documentFrequency,
        (text) => analyzeDocument(text, deps.levers),
      );
      return {
        item: candidate,
        score: base.score + value,
        signals: buildSignals(understanding, candidate, [
          { name: "bm25", value },
          { name: "recency", value: base.score },
        ]),
      };
    },
  };
}
