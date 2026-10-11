import { levelSpellingContent } from "../../content/levels/level-spelling.ts";
import { matchTermGroups } from "../index/inverted-index.ts";
import { categoryFromTokens } from "../query-understanding/category-from-tokens.ts";
import { retokenize } from "../query-understanding/entities.ts";
import { understandingForMatching } from "../query-understanding/understand.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { termGroupsFor, understandQuery } from "../text/analyze-query.ts";
import { itemText } from "../text/item-text.ts";
import { buildVocabulary, correctTokens } from "../text/spell-correction.ts";
import type { EvolutionLevel, InvertedIndex, LevelDeps, LevelRanker } from "../types/level.ts";
import type { LeverConfiguration, QueryUnderstanding, SpellingCorrection } from "../types/query.ts";
import { createRanker as createPrevious } from "./level-1-lexical.ts";

export const meta: EvolutionLevel = {
  id: "level-1-spelling",
  ordinal: 4,
  label: "Spelling normalization",
  capability:
    "Correct misspelt query words against the listing vocabulary, then match the corrected words.",
  changes: "both",
  mechanism: levelSpellingContent.mechanism,
  tradeOff: levelSpellingContent.tradeOff,
  fixesFailureMode: levelSpellingContent.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-spelling.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "ligth bulb",
      expectedDifference:
        "Spelling correction rewrites 'ligth' to 'light' before lookup: the dimmable light bulb enters the top 10, while chapter 3 returns nothing for 'ligth bulb' because it looks the typo up as typed.",
      assertion: "itemEnters",
      assertionTarget: "wands-41053",
    },
  ],
  candidateWidth: 5000,
};

interface CorrectedQuery {
  readonly corrected: QueryUnderstanding;
  readonly fixes: readonly SpellingCorrection[];
}

/** A suggestion must be an established word: seen in more than one listing. */
const MIN_DOCUMENTS_FOR_CORRECTION = 2;

// Every later level builds this level again as its "previous". The vocabulary depends only on
// the index (built with the same levers), so it is counted once per index, not once per level.
const vocabularyByIndex = new WeakMap<InvertedIndex, ReadonlySet<string>>();

function vocabularyFor(deps: LevelDeps): ReadonlySet<string> {
  const known = vocabularyByIndex.get(deps.index);
  if (known !== undefined) {
    return known;
  }
  const vocabulary = buildVocabulary(
    deps.index.availableItems.map((entry) => itemText(entry)),
    MIN_DOCUMENTS_FOR_CORRECTION,
    deps.levers.variantRules,
  );
  vocabularyByIndex.set(deps.index, vocabulary);
  return vocabulary;
}

/** Correct the typo first, then run the chapter 3 engine on the corrected words. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  const vocabulary = vocabularyFor(deps);
  const correctedByQuery = new WeakMap<QueryUnderstanding, CorrectedQuery>();
  function correctedFor(understanding: QueryUnderstanding): CorrectedQuery {
    const known = correctedByQuery.get(understanding);
    if (known !== undefined) {
      return known;
    }
    const result = applyCorrection(understanding, vocabulary, deps.levers);
    correctedByQuery.set(understanding, result);
    return result;
  }
  return {
    match: (understanding) => correctedCandidates(deps, previous, correctedFor, understanding),
    score: (understanding, candidate) =>
      correctedScoring(previous, correctedFor, understanding, candidate),
    correctionsFor: (understanding) => correctedFor(understanding).fixes,
  };
}

function correctedCandidates(
  deps: LevelDeps,
  previous: LevelRanker,
  correctedFor: (understanding: QueryUnderstanding) => CorrectedQuery,
  understanding: QueryUnderstanding,
): ReturnType<LevelRanker["match"]> {
  previous.match(understanding);
  const matching = understandingForMatching(correctedFor(understanding).corrected);
  return matchTermGroups(deps.index, termGroupsFor(matching, deps.levers.synonymGroups));
}

function correctedScoring(
  previous: LevelRanker,
  correctedFor: (understanding: QueryUnderstanding) => CorrectedQuery,
  understanding: QueryUnderstanding,
  candidate: Parameters<LevelRanker["score"]>[1],
): ReturnType<LevelRanker["score"]> {
  const { corrected, fixes } = correctedFor(understanding);
  const base = previous.score(corrected, candidate);
  return {
    item: candidate,
    score: base.score,
    signals: buildSignals(corrected, candidate, [
      ...base.signals.map((signal) => ({ name: signal.name, value: signal.value, weight: 1 })),
      { name: "spellingCorrection", value: fixes.length > 0 ? 1 : 0 },
    ]),
  };
}

function applyCorrection(
  understanding: QueryUnderstanding,
  vocabulary: ReadonlySet<string>,
  levers: LeverConfiguration,
): CorrectedQuery {
  // The pinned demo typos run first, so a corpus artifact cannot win the edit-distance race.
  const pinned = retokenize(understanding.tokens, understanding.spellingCorrection);
  const { corrected, corrections } = correctTokens(pinned, vocabulary);
  const fixes = mergeCorrections(corrections, understanding.spellingCorrection);
  if (pinned === understanding.tokens && corrections.length === 0) {
    return { corrected: understanding, fixes };
  }
  const rebuilt = understandQuery(corrected.join(" "), levers, understanding.leverOverrides ?? {});
  return {
    corrected: {
      ...understanding,
      tokens: corrected,
      normalizedTokens: rebuilt.normalizedTokens,
      expandedTokens: rebuilt.expandedTokens,
      predictedCategoryId: categoryFromTokens(corrected) ?? understanding.predictedCategoryId,
      spellingCorrection: fixes,
    },
    fixes,
  };
}

function mergeCorrections(
  vocabulary: readonly SpellingCorrection[],
  hardcoded: readonly SpellingCorrection[],
): SpellingCorrection[] {
  const from = new Set(vocabulary.map((fix) => fix.from));
  return [...vocabulary, ...hardcoded.filter((fix) => !from.has(fix.from))];
}
