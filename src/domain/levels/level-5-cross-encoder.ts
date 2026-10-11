import { level5Content } from "../../content/levels/level-5.ts";
import { CROSS_ENCODER_ARTIFACT_PATH } from "../cross-encoder/model-spec.ts";
import { queryTextForEncoding } from "../query-understanding/understand.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { compareScoreThenId } from "../sort-score.ts";
import { itemText } from "../text/item-text.ts";
import type { AsyncLevelRanker, CrossEncoderDeps, EvolutionLevel } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import type { ScoredCandidate } from "../types/ranking.ts";
import { createRanker as createPrevious } from "./level-4-hybrid.ts";

const RERANK_WIDTH = 50;

export const meta: EvolutionLevel = {
  id: "level-5-cross-encoder",
  ordinal: 10,
  label: "Cross-encoder reranking",
  capability:
    "Read the query and each of chapter 9's first 50 listings together, then rerank them.",
  changes: "scoring",
  mechanism: level5Content.mechanism,
  tradeOff: level5Content.tradeOff,
  fixesFailureMode: level5Content.fixesFailureMode,
  prerequisites: [
    {
      kind: "model",
      artifactPath: "data/models/ranker-corrected.json",
      buildCommand: "npm run data:train",
    },
    {
      kind: "embeddings",
      artifactPath: "data/embeddings.bin",
      buildCommand: "npm run data:embeddings",
    },
    {
      kind: "model",
      artifactPath: CROSS_ENCODER_ARTIFACT_PATH,
      buildCommand: "npm run data:cross-encoder",
    },
  ],
  sourceSpecifier: "src/domain/levels/level-5-cross-encoder.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "lamp shade",
      expectedDifference:
        "Word and vector similarity put an odd 'dirt bike' fabric empire shade at the top for 'lamp shade'. Joint reranking reads the two texts together and drops it out of the top 10.",
      assertion: "itemExits",
      assertionTarget: "wands-32705",
    },
  ],
  candidateWidth: RERANK_WIDTH,
};

/** Chapter 9 retrieves; this chapter spends neural inference only on its first 50. */
export function createRanker(deps: CrossEncoderDeps): AsyncLevelRanker {
  const previous = createPrevious(deps);
  const scoredByQuery = new WeakMap<QueryUnderstanding, ReadonlyMap<string, ScoredCandidate>>();
  return {
    async match(understanding) {
      const shortlist = previous
        .match(understanding)
        .items.map((item) => previous.score(understanding, item))
        .sort((left, right) =>
          compareScoreThenId([left.item.id, left.score], [right.item.id, right.score]),
        )
        .slice(0, RERANK_WIDTH);
      const jointScores = await deps.crossEncoder.scorePairs(
        queryTextForEncoding(understanding.rawText),
        shortlist.map(({ item }) => itemText(item)),
      );
      if (jointScores.length !== shortlist.length || !jointScores.every(Number.isFinite)) {
        throw new Error(
          `Cross-encoder returned ${jointScores.length} scores for ${shortlist.length} candidates; all scores must be finite.`,
        );
      }
      const scored = new Map<string, ScoredCandidate>();
      for (const [index, baseline] of shortlist.entries()) {
        const score = jointScores[index] as number;
        scored.set(baseline.item.id, {
          item: baseline.item,
          score,
          signals: buildSignals(understanding, baseline.item, [
            { name: "crossEncoder", value: score },
            { name: "previousRank", value: index + 1 },
            ...baseline.signals.filter(
              (signal) => signal.name === "rrf" || signal.name === "vectorSimilarity",
            ),
          ]),
        });
      }
      scoredByQuery.set(understanding, scored);
      return { items: shortlist.map(({ item }) => item) };
    },
    score(understanding, candidate) {
      const scored = scoredByQuery.get(understanding)?.get(candidate.id);
      if (scored === undefined) {
        throw new Error(
          "Cross-encoder scoring requires an awaited match for this query and candidate.",
        );
      }
      return scored;
    },
  };
}
