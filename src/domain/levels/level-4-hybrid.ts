import { level4Content } from "../../content/levels/level-4.ts";
import { reciprocalRankFusion } from "../fusion/reciprocal-rank-fusion.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { compareScoreThenId } from "../sort-score.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { EvolutionLevel, LevelDeps, LevelRanker } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { cosineSimilarity, vectorRetrieve } from "../vector/vector-retrieval.ts";
import { createRanker as createPrevious } from "./level-3-learned.ts";

const VECTOR_LIMIT = 50;
const RRF_K = 60;

export const meta: EvolutionLevel = {
  id: "level-4-hybrid",
  ordinal: 9,
  label: "Hybrid search",
  capability: "Widen matching with precomputed document vectors and fuse the two rankings.",
  changes: "both",
  mechanism: level4Content.mechanism,
  tradeOff: level4Content.tradeOff,
  fixesFailureMode: level4Content.fixesFailureMode,
  prerequisites: [
    {
      kind: "embeddings",
      artifactPath: "data/embeddings.bin",
      buildCommand: "npm run data:embeddings",
    },
  ],
  sourceSpecifier: "src/domain/levels/level-4-hybrid.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "area rug",
      expectedDifference:
        "Hybrid retrieval widens chapter 8's candidate set: the vector list adds the 'tomas chevron rug', which never writes 'area rug', and the fused order lifts it into the top 10.",
      assertion: "itemEnters",
      assertionTarget: "wands-26163",
    },
  ],
  candidateWidth: 5000,
};

/** Duplication across levels is accepted so each evolution level stays independently readable. */
export function createRanker(deps: LevelDeps): LevelRanker {
  const previous = createPrevious(deps);
  const byId = new Map(deps.index.availableItems.map((item) => [item.id, item]));
  const fusionByQuery = new WeakMap<QueryUnderstanding, ReadonlyMap<string, number>>();
  return {
    match(understanding) {
      const scores = fusionScores(understanding, previous, deps, fusionByQuery);
      return { items: [...scores.keys()].flatMap((id) => itemOf(byId, id)) };
    },
    score(understanding, candidate) {
      const rrf = fusionScores(understanding, previous, deps, fusionByQuery).get(candidate.id) ?? 0;
      const vectorSimilarity = cosineFor(understanding.queryVector, candidate.id, deps);
      return {
        item: candidate,
        score: rrf,
        signals: buildSignals(understanding, candidate, [
          { name: "rrf", value: rrf },
          { name: "vectorSimilarity", value: vectorSimilarity },
        ]),
      };
    },
  };
}

function fusionScores(
  understanding: QueryUnderstanding,
  previous: LevelRanker,
  deps: LevelDeps,
  cache: WeakMap<QueryUnderstanding, ReadonlyMap<string, number>>,
): ReadonlyMap<string, number> {
  const cached = cache.get(understanding);
  if (cached !== undefined) {
    return cached;
  }
  const lexical = previous.match(understanding);
  const vectorIds = vectorIdsFor(understanding.queryVector, deps);
  const lexicalRanked = rankLexical(previous, understanding, lexical.items);
  const fused = reciprocalRankFusion([lexicalRanked, vectorIds], RRF_K);
  const scores = new Map(fused.map((row) => [row.itemId, row.score]));
  cache.set(understanding, scores);
  return scores;
}

function vectorIdsFor(queryVector: Float32Array | null, deps: LevelDeps): string[] {
  if (queryVector === null || deps.vectorStore === undefined) {
    return [];
  }
  return vectorRetrieve(queryVector, deps.vectorStore, VECTOR_LIMIT).map((hit) => hit.itemId);
}

function cosineFor(queryVector: Float32Array | null, itemId: string, deps: LevelDeps): number {
  if (queryVector === null || deps.vectorStore === undefined) {
    return 0;
  }
  const documentVector = deps.vectorStore.getVector(itemId);
  if (documentVector === undefined) {
    return 0;
  }
  return cosineSimilarity(queryVector, documentVector);
}

function rankLexical(
  previous: LevelRanker,
  understanding: QueryUnderstanding,
  items: readonly CorpusItem[],
): string[] {
  return items
    .map((item) => ({ id: item.id, score: previous.score(understanding, item).score }))
    .sort((left, right) => compareScoreThenId([left.id, left.score], [right.id, right.score]))
    .map((row) => row.id);
}

function itemOf(byId: ReadonlyMap<string, CorpusItem>, id: string): CorpusItem[] {
  const item = byId.get(id);
  return item === undefined ? [] : [item];
}
