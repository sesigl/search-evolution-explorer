import { levelCanonicalContent } from "../../content/levels/level-canonical.ts";
import { annotateQuery, type QueryAnnotation } from "../canonical/annotate.ts";
import { attributeMatch, keepCandidate } from "../canonical/match.ts";
import { decidePolicy, type PolicyDecision } from "../canonical/policy.ts";
import { retokenize } from "../query-understanding/entities.ts";
import { buildSignals } from "../signals/build-signals.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { createRanker as createPrevious } from "./level-1-entities.ts";

const FILTER_BOOST = 2;
const ATTRIBUTE_BOOST = 1;
/**
 * Assumed ad-side quality until it is measured per property. FILTER runs only
 * above these gates; lower them and fewer queries filter. The lesson names
 * the trade-off: assumed gates filter aggressively, measured gates filter safely.
 */
const AD_PRECISION = 0.98;
const AD_COVERAGE = 0.9;

export const meta: EvolutionLevel = {
  id: "level-1-canonical",
  ordinal: 6,
  label: "Canonical search policy",
  capability: "Filter or boost by canonical product type with a confidence-gated policy.",
  changes: "both",
  mechanism: levelCanonicalContent.mechanism,
  tradeOff: levelCanonicalContent.tradeOff,
  fixesFailureMode: levelCanonicalContent.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-canonical.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "area rug",
      expectedDifference:
        "The policy filters the 'non slip area rug pad' out of the top 10 for 'area rug'. The pad writes 'area rug' too, so words and attributes cannot separate it; the canonical product family can.",
      assertion: "itemExits",
      assertionTarget: "wands-32625",
    },
  ],
  candidateWidth: 5000,
};

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  return {
    match: (understanding) => {
      const base = previous.match(understanding);
      const annotation = readAnnotation(understanding, previous);
      if (annotation.productType === null || readDecision(annotation) !== "FILTER") {
        return base;
      }
      return { items: base.items.filter((entry) => keepCandidate(annotation, entry)) };
    },
    score: (understanding, candidate) => {
      const base = previous.score(understanding, candidate);
      const annotation = readAnnotation(understanding, previous);
      const matched = attributeMatch(annotation, candidate);
      const active = annotation.productType !== null && readDecision(annotation) !== "FEATURE";
      const boost = active
        ? FILTER_BOOST * matched.productTypeMatch + ATTRIBUTE_BOOST * matched.attributeMatch
        : 0;
      return {
        item: candidate,
        score: base.score + boost,
        signals: buildSignals(understanding, candidate, [
          ...base.signals.map((signal) => ({
            name: signal.name,
            value: signal.value,
            weight: signal.weight,
          })),
          { name: "productTypeMatch", value: matched.productTypeMatch, weight: FILTER_BOOST },
          { name: "attributeMatch", value: matched.attributeMatch, weight: ATTRIBUTE_BOOST },
          { name: "policyFilter", value: readDecision(annotation) === "FILTER" ? 1 : 0 },
        ]),
      };
    },
    correctionsFor: (understanding) => previous.correctionsFor?.(understanding) ?? [],
    conceptsFor: (understanding) => previous.conceptsFor?.(understanding) ?? [],
  };
}

/** Annotate corrected words, so "iphne 13" tags what "iphone 13" tags. */
function readAnnotation(understanding: QueryUnderstanding, previous: LevelRanker): QueryAnnotation {
  const fixes = previous.correctionsFor?.(understanding) ?? [];
  return annotateQuery(retokenize(understanding.tokens, fixes).join(" "));
}

function readDecision(annotation: QueryAnnotation): PolicyDecision {
  return decidePolicy({
    confidence: annotation.confidence,
    adPrecision: AD_PRECISION,
    coverage: AD_COVERAGE,
  });
}
