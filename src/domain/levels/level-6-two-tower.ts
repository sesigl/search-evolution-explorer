import { level6Content } from "../../content/levels/level-6.ts";
import { queryTextForEncoding } from "../query-understanding/understand.ts";
import { buildSignals } from "../signals/build-signals.ts";
import { itemText } from "../text/item-text.ts";
import { combineTowerScores } from "../two-tower/combine-scores.ts";
import { TWO_TOWER_PATH, type TwoTowerRetrieval } from "../two-tower/model.ts";
import { projectVector } from "../two-tower/projection.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { AsyncLevelRanker, CrossEncoderDeps, EvolutionLevel } from "../types/level.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import type { ScoredCandidate } from "../types/ranking.ts";
import { vectorRetrieve } from "../vector/vector-retrieval.ts";
import { createRanker as createPrevious, meta as previousMeta } from "./level-5-cross-encoder.ts";

interface TwoTowerDeps extends CrossEncoderDeps {
  readonly twoTower: TwoTowerRetrieval;
}

export const meta: EvolutionLevel = {
  id: "level-6-two-tower",
  ordinal: 11,
  label: "Two-tower retrieval",
  capability:
    "Find new candidates with trained independent towers, then keep chapter 10's joint ranking.",
  changes: "both",
  mechanism: level6Content.mechanism,
  tradeOff: level6Content.tradeOff,
  fixesFailureMode: level6Content.fixesFailureMode,
  prerequisites: [
    ...previousMeta.prerequisites,
    { kind: "model", artifactPath: TWO_TOWER_PATH, buildCommand: "npm run data:two-tower" },
  ],
  sourceSpecifier: "src/domain/levels/level-6-two-tower.ts",
  implemented: true,
  guidedExamples: [
    {
      queryText: "3 1/2 inch drawer pull",
      expectedDifference:
        "Trained retrieval pulls a 'cabinet and drawer bar pull' into the top 10 for '3 1/2 inch drawer pull' that chapter 10 never returned. The learned branch supplies this candidate; the joint score is reused for the listings both chapters share. Open the row to see the trained terms.",
      assertion: "itemEnters",
      assertionTarget: "wands-34002",
    },
  ],
  candidateWidth: 100,
};

/** Keep the preceding cascade. Spend additional joint inference only on new candidates. */
export function createRanker(deps: TwoTowerDeps): AsyncLevelRanker {
  const previous = createPrevious(deps);
  const available = new Map(deps.index.availableItems.map((item) => [item.id, item]));
  const scoredByQuery = new WeakMap<QueryUnderstanding, ReadonlyMap<string, ScoredCandidate>>();
  return {
    async match(understanding) {
      if (understanding.queryVector === null) {
        throw new Error("Two-tower retrieval requires the frozen query embedding.");
      }
      const queryVector = projectVector(understanding.queryVector, deps.twoTower.queryWeights);
      const hits = vectorRetrieve(
        queryVector,
        deps.twoTower.itemVectors,
        deps.twoTower.retrievalLimit,
      );
      const baseline = await previous.match(understanding);
      const scored = new Map(
        baseline.items.map((item) => [item.id, previous.score(understanding, item)]),
      );
      const additions = hits.flatMap((hit) => {
        const item = available.get(hit.itemId);
        return item === undefined || scored.has(item.id) ? [] : [item];
      });
      await scoreAdditions(understanding, additions, deps, scored);
      for (const [rank, hit] of hits.entries()) {
        const entry = scored.get(hit.itemId);
        if (entry !== undefined) {
          scored.set(hit.itemId, {
            ...entry,
            signals: [
              ...entry.signals,
              ...buildSignals(understanding, entry.item, [
                { name: "twoTowerRank", value: rank + 1 },
              ]),
            ],
          });
        }
      }
      for (const [id, entry] of scored) {
        scored.set(id, combineTowerScores(understanding, entry, queryVector, deps.twoTower));
      }
      scoredByQuery.set(understanding, scored);
      return { items: [...scored.values()].map((entry) => entry.item) };
    },
    score(understanding, candidate) {
      const result = scoredByQuery.get(understanding)?.get(candidate.id);
      if (result === undefined) {
        throw new Error(
          "Two-tower scoring requires an awaited match for this query and candidate.",
        );
      }
      return result;
    },
  };
}

async function scoreAdditions(
  understanding: QueryUnderstanding,
  additions: readonly CorpusItem[],
  deps: TwoTowerDeps,
  scored: Map<string, ScoredCandidate>,
): Promise<void> {
  if (additions.length === 0) {
    return;
  }
  const jointScores = await deps.crossEncoder.scorePairs(
    queryTextForEncoding(understanding.rawText),
    additions.map(itemText),
  );
  if (jointScores.length !== additions.length || !jointScores.every(Number.isFinite)) {
    throw new Error("Two-tower additions require one finite cross-encoder score per listing.");
  }
  for (const [index, score] of jointScores.entries()) {
    const item = additions[index];
    if (item === undefined) {
      throw new Error("Missing learned candidate for joint score.");
    }
    scored.set(item.id, {
      item,
      score,
      signals: buildSignals(understanding, item, [
        { name: "crossEncoder", value: score },
        { name: "learnedRetrievalOnly", value: 1 },
      ]),
    });
  }
}
