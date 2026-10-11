import { level2Content } from "../../content/levels/level-2.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { priceFitScore } from "../signals/price-fit.ts";
import { computeStaticQuality } from "../signals/static-quality.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { createRanker as createPrevious } from "./level-1-canonical.ts";

const CATEGORY_BOOST = 2;
const PRICE_FIT_BOOST = 1;
/** Recency and other static quality must not outweigh a real text match. */
const STATIC_QUALITY_WEIGHT = 0.2;

export const meta: EvolutionLevel = {
  id: "level-2-boosting",
  ordinal: 7,
  label: "Attribute boosting",
  capability: "Boost lexical candidates with query attributes and static quality.",
  changes: "scoring",
  mechanism: level2Content.mechanism,
  tradeOff: level2Content.tradeOff,
  fixesFailureMode: level2Content.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-2-boosting.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "couch",
      expectedDifference:
        "Category and static-quality boosts push the 'couch riser' accessory out of the top 10 for 'couch': it matches the word but sits in the wrong category and price band.",
      assertion: "itemExits",
      assertionTarget: "wands-1217",
    },
  ],
  candidateWidth: 5000,
};

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  const quality = computeStaticQuality(deps.index.availableItems, deps.clock);
  return {
    match: previous.match,
    score(understanding, candidate) {
      const base = previous.score(understanding, candidate);
      const categoryMatch = categoryMatchScore(understanding, candidate);
      const priceFit = priceFitScore(understanding, candidate);
      const staticQuality = quality.get(candidate.id);
      const recency = staticQuality?.recency ?? 0;
      const titleQuality = staticQuality?.titleQuality ?? 0;
      const pricePercentile = staticQuality?.pricePercentile ?? 0;
      const added =
        CATEGORY_BOOST * categoryMatch +
        PRICE_FIT_BOOST * priceFit +
        STATIC_QUALITY_WEIGHT * (recency + titleQuality + pricePercentile);
      return {
        item: candidate,
        score: base.score + added,
        signals: buildSignals(understanding, candidate, [
          // Preserve each carried weight: the spelling flag has none, so the printed
          // total still matches the score for corrected queries.
          ...base.signals.map((signal) => ({
            name: signal.name,
            value: signal.value,
            weight: signal.weight,
          })),
          { name: "categoryMatch", value: categoryMatch, weight: CATEGORY_BOOST },
          { name: "priceFit", value: priceFit, weight: PRICE_FIT_BOOST },
          { name: "recency", value: recency, weight: STATIC_QUALITY_WEIGHT },
          { name: "titleQuality", value: titleQuality, weight: STATIC_QUALITY_WEIGHT },
          { name: "pricePercentile", value: pricePercentile, weight: STATIC_QUALITY_WEIGHT },
        ]),
      };
    },
  };
}

function categoryMatchScore(understanding: QueryUnderstanding, candidate: CorpusItem): number {
  if (understanding.predictedCategoryId === null) {
    return 0;
  }
  if (understanding.predictedCategoryId === candidate.categoryId) {
    return 1;
  }
  return 0;
}
