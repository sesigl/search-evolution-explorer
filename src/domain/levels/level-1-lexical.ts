import { level1Content } from "../../content/levels/level-1.ts";
import { bm25MaxScore, bm25Score } from "../index/bm25.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { freshnessScore, snapshotInstant } from "../signals/freshness.ts";
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

/** How much a listing posted on the snapshot day can gain, in text-fit units (0 to 1). */
const FRESHNESS_WEIGHT = 0.1;
/** After this many days, the freshness bonus is half as large. */
const FRESHNESS_HALF_LIFE_DAYS = 7;

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  // The catalog is a fixed snapshot, so age is counted from its newest listing, not from the
  // wall clock. The same evaluation then gives the same numbers on any day it runs.
  const snapshot = snapshotInstant(deps.index.availableItems);
  return {
    match: previous.match,
    score(understanding, candidate) {
      const raw = bm25Score(
        understanding.expandedTokens,
        candidate,
        deps.index.documentCount,
        deps.index.averageLength,
        deps.index.documentFrequency,
        (text) => analyzeDocument(text, deps.levers),
      );
      const max = bm25MaxScore(
        understanding.expandedTokens,
        deps.index.documentCount,
        deps.index.documentFrequency,
      );
      const textFit = max > 0 ? raw / max : 0;
      const freshness = freshnessScore(candidate.postedAt, snapshot, FRESHNESS_HALF_LIFE_DAYS);
      return {
        item: candidate,
        score: textFit + FRESHNESS_WEIGHT * freshness,
        signals: buildSignals(understanding, candidate, [
          { name: "bm25", value: textFit, weight: 1 },
          { name: "recency", value: freshness, weight: FRESHNESS_WEIGHT },
        ]),
      };
    },
  };
}
