import { levelEntitiesContent } from "../../content/levels/level-entities.ts";
import {
  type ConceptDetail,
  conceptDetail,
  type EntityConcept,
  extractItemConcepts,
  extractQueryConcepts,
  retokenize,
  satisfiesConcepts,
} from "../query-understanding/entities.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { itemText } from "../text/item-text.ts";
import { tokenize } from "../text/tokenize.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { EvolutionLevel, InvertedIndex, LevelDeps, LevelRanker } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import type { CandidateSet, RetrievalSignal } from "../types/ranking.ts";
import { createRanker as createPrevious } from "./level-1-spelling.ts";

const STRUCTURED_MATCH_WEIGHT = 1;
const LEXICAL_CONCEPT_WEIGHT = 0.5;

export const meta: EvolutionLevel = {
  id: "level-1-entities",
  ordinal: 5,
  label: "Entity-tagged matching",
  capability: "Require every named attribute, but accept it in words or in listing fields.",
  changes: "both",
  mechanism: levelEntitiesContent.mechanism,
  tradeOff: levelEntitiesContent.tradeOff,
  fixesFailureMode: levelEntitiesContent.fixesFailureMode,
  prerequisites: [],
  sourceSpecifier: "src/domain/levels/level-1-entities.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "moen faucet",
      expectedDifference:
        "Entity tagging reads brand MOEN and type FAUCET: the Moen faucet whose title never writes 'moen' enters the top 10, although chapter 4 finds nothing for it. The ontology is coarse, so it also adds a Moen cartridge kit — the precision this recall costs.",
      assertion: "itemEnters",
      assertionTarget: "wands-26568",
    },
  ],
  candidateWidth: 5000,
};

/** AND over concepts, OR over representations: keep chapter 4 and add attribute matches. */
// Every later level builds this level again as its "previous". The listing concepts depend
// only on the index, so they are extracted once per index, not once per level.
const conceptsByIndex = new WeakMap<InvertedIndex, ReadonlyMap<string, readonly EntityConcept[]>>();

function itemConceptsFor(index: InvertedIndex): ReadonlyMap<string, readonly EntityConcept[]> {
  const known = conceptsByIndex.get(index);
  if (known !== undefined) {
    return known;
  }
  const conceptsByItem = new Map<string, readonly EntityConcept[]>();
  for (const entry of index.availableItems) {
    conceptsByItem.set(entry.id, extractItemConcepts(entry));
  }
  conceptsByIndex.set(index, conceptsByItem);
  return conceptsByItem;
}

export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  const conceptsByItem = itemConceptsFor(deps.index);
  const unionByQuery = new WeakMap<QueryUnderstanding, CandidateSet>();
  function unionFor(understanding: QueryUnderstanding): CandidateSet {
    const known = unionByQuery.get(understanding);
    if (known !== undefined) return known;
    const union = widenCandidates(deps, conceptsByItem, previous, understanding);
    unionByQuery.set(understanding, union);
    return union;
  }
  return {
    match: (understanding) => unionFor(understanding),
    score: (understanding, candidate) =>
      conceptScoring(conceptsByItem, previous, understanding, candidate),
    correctionsFor: (understanding) => previous.correctionsFor?.(understanding) ?? [],
    conceptsFor: (understanding) => queryConcepts(understanding, previous),
  };
}

/** Concepts from corrected words, so "iphne 13" tags what "iphone 13" tags. */
function queryConcepts(understanding: QueryUnderstanding, previous: LevelRanker) {
  const fixes = previous.correctionsFor?.(understanding) ?? [];
  const tokens = retokenize(understanding.tokens, fixes);
  const tagged = tokens === understanding.tokens ? understanding : { ...understanding, tokens };
  return extractQueryConcepts(tagged);
}

function widenCandidates(
  deps: LevelDeps,
  conceptsByItem: ReadonlyMap<string, readonly EntityConcept[]>,
  previous: LevelRanker,
  understanding: QueryUnderstanding,
): CandidateSet {
  const base = previous.match(understanding);
  const concepts = queryConcepts(understanding, previous);
  if (concepts.length === 0) return base;
  const seen = new Set(base.items.map((entry) => entry.id));
  const added: CorpusItem[] = [];
  for (const entry of deps.index.availableItems) {
    if (!seen.has(entry.id)) {
      const known = conceptsByItem.get(entry.id) ?? [];
      if (satisfiesConcepts(concepts, tokenize(itemText(entry)), known)) {
        added.push(entry);
        seen.add(entry.id);
      }
    }
  }
  return { items: [...base.items, ...added] };
}

function conceptScoring(
  conceptsByItem: ReadonlyMap<string, readonly EntityConcept[]>,
  previous: LevelRanker,
  understanding: QueryUnderstanding,
  candidate: CorpusItem,
): ReturnType<LevelRanker["score"]> {
  const base = previous.score(understanding, candidate);
  const concepts = queryConcepts(understanding, previous);
  const known = conceptsByItem.get(candidate.id) ?? [];
  const detail = conceptDetail(concepts, tokenize(itemText(candidate)), known);
  return {
    item: candidate,
    score:
      base.score +
      STRUCTURED_MATCH_WEIGHT * detail.structural.length +
      LEXICAL_CONCEPT_WEIGHT * detail.lexical.length,
    signals: annotate(
      buildSignals(understanding, candidate, [
        ...base.signals.map((signal) => ({
          name: signal.name,
          value: signal.value,
          weight: signal.weight,
        })),
        {
          name: "structuredConceptMatch",
          value: detail.structural.length,
          weight: STRUCTURED_MATCH_WEIGHT,
        },
        {
          name: "lexicalConceptMatch",
          value: detail.lexical.length,
          weight: LEXICAL_CONCEPT_WEIGHT,
        },
      ]),
      detail,
    ),
  };
}

/** Name the deciding concepts on the two signals, so a demoted listing explains itself. */
function annotate(signals: readonly RetrievalSignal[], detail: ConceptDetail) {
  const named = { structuredConceptMatch: detail.structural, lexicalConceptMatch: detail.lexical };
  return signals.map((signal) => {
    const concepts = named[signal.name as keyof typeof named];
    if (concepts === undefined) return signal;
    return { ...signal, explanation: `${signal.explanation} (${concepts.join(", ") || "none"})` };
  });
}
