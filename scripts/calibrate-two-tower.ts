import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { readLevers, readModel } from "../src/adapters/artifact-json.ts";
import { createBinaryVectorStore } from "../src/adapters/binary-vector-store.ts";
import { createFileCorpusSource } from "../src/adapters/file-corpus-source.ts";
import { createTransformersCrossEncoder } from "../src/adapters/transformers-cross-encoder.ts";
import { mrr } from "../src/domain/evaluation/mrr.ts";
import { ndcgAt } from "../src/domain/evaluation/ndcg.ts";
import { recallAt } from "../src/domain/evaluation/recall.ts";
import { buildInvertedIndex } from "../src/domain/index/inverted-index.ts";
import { createRanker as hybridRanker } from "../src/domain/levels/level-4-hybrid.ts";
import { createRanker } from "../src/domain/levels/level-6-two-tower.ts";
import { understand } from "../src/domain/query-understanding/understand.ts";
import { analyzeDocument } from "../src/domain/text/analyze-document.ts";
import { itemText } from "../src/domain/text/item-text.ts";
import type { TwoTowerRetrieval } from "../src/domain/two-tower/model.ts";
import type { Judgment } from "../src/domain/types/evaluation.ts";
import type { CrossEncoderDeps } from "../src/domain/types/level.ts";
import type { ScoredCandidate } from "../src/domain/types/ranking.ts";

const directory = "data/models/two-tower";
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
const model = JSON.parse(readFileSync(`${directory}/model.json`, "utf8"));
const prepared = JSON.parse(readFileSync(".cache/two-tower/training.json", "utf8")) as {
  queries: { query: string; vector: number[]; split: string }[];
  judgments: Judgment[];
  titles: number[][];
};
const corpus = createFileCorpusSource("data/corpus.ndjson");
const items = await corpus.readItems();
const categories = await corpus.readCategories();
const levers = readLevers();
const corrected = readModel("data/models/ranker-corrected.json");
if (corrected === undefined) {
  throw new Error("Build Chapter 5's corrected ranker first.");
}
const deps: CrossEncoderDeps = {
  corpus,
  index: buildInvertedIndex(items, (text) => analyzeDocument(text, levers)),
  levers,
  clock: { now: () => new Date() },
  model: corrected,
  vectorStore: createBinaryVectorStore("data/embeddings.bin", "data/embeddings.manifest.json"),
  crossEncoder: await createTransformersCrossEncoder(".cache", true),
};
const twoTower: TwoTowerRetrieval = {
  queryWeights: model.queryWeights,
  itemVectors: createBinaryVectorStore(`${directory}/items.bin`, `${directory}/manifest.json`),
  scoreWeight: 0,
  retrievalLimit: 50,
};
const ranker = createRanker({ ...deps, twoTower });
const genericVectors = new Map(
  items.map((item, i) => {
    const base = deps.vectorStore?.getVector(item.id);
    if (base === undefined) {
      throw new Error("Missing base embedding.");
    }
    const values = base.map(
      (value, dimension) => 0.2 * value + 0.8 * (prepared.titles[i]?.[dimension] ?? 0),
    );
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    return [item.id, values.map((value) => value / norm)] as const;
  }),
);
const generic = createRanker({
  ...deps,
  twoTower: {
    queryWeights: Array.from({ length: 384 }, (_, row) =>
      Array.from({ length: 384 }, (_entry, column) => Number(row === column)),
    ),
    itemVectors: {
      itemIds: () => items.map((item) => item.id),
      dimensions: () => 384,
      getVector: (id) => genericVectors.get(id),
    },
    scoreWeight: 0,
    retrievalLimit: 50,
  },
});
const hybrid = hybridRanker(deps);
interface Measurement {
  name: string;
  weight: number;
  limit: number;
  ndcg: number[];
  mrr: number[];
  recall: number[];
}
const measurements: Measurement[] = [0, 2, 4, 8, 16].flatMap((weight) =>
  [10, 25, 50].map((limit) => ({ name: "trained", weight, limit, ndcg: [], mrr: [], recall: [] })),
);
const controls: Measurement[] = ["chapter-5", "hybrid-100", "generic-title-100"].map((name) => ({
  name,
  weight: 0,
  limit: 50,
  ndcg: [],
  mrr: [],
  recall: [],
}));
for (const query of prepared.queries.filter((row) => row.split === "validation")) {
  const grades = new Map(
    prepared.judgments
      .filter((row) => row.queryText === query.query)
      .map((row) => [row.itemId, row.grade]),
  );
  if (grades.size === 0) {
    continue;
  }
  const understanding = {
    ...understand(query.query, levers, {}, categories),
    queryVector: new Float32Array(query.vector),
  };
  // biome-ignore lint/performance/noAwaitInLoops: deterministic bounded neural work per query
  const matched = await ranker.match(understanding);
  const candidates = matched.items.map((item) => ranker.score(understanding, item));
  for (const measurement of measurements) {
    record(measurement, candidates, grades);
  }
  const baseline = candidates.filter((row) => !signalValue(row, "learnedRetrievalOnly"));
  record(controls[0] as Measurement, baseline, grades);
  const genericMatch = await generic.match(understanding);
  record(
    controls[2] as Measurement,
    genericMatch.items.map((item) => generic.score(understanding, item)),
    grades,
  );
  const wider = hybrid
    .match(understanding)
    .items.map((item) => hybrid.score(understanding, item))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, 100);
  const joint = await deps.crossEncoder.scorePairs(
    query.query,
    wider.map((row) => itemText(row.item)),
  );
  record(
    controls[1] as Measurement,
    wider.map((row, i) => ({
      ...row,
      score: joint[i] as number,
      signals: [
        { name: "crossEncoder", value: joint[i] as number, explanation: "Measured joint score" },
      ],
    })),
    grades,
  );
  process.stdout.write(`Validated ${query.query}\n`);
}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const summary = [...measurements, ...controls].map((row) => ({
  name: row.name,
  scoreWeight: row.weight,
  retrievalLimit: row.limit,
  queries: row.ndcg.length,
  ndcgAt10: mean(row.ndcg),
  mrr: mean(row.mrr),
  recallAt50: mean(row.recall),
}));
const best = summary
  .filter((row) => row.name === "trained")
  .sort(
    (a, b) =>
      b.ndcgAt10 - a.ndcgAt10 ||
      a.retrievalLimit - b.retrievalLimit ||
      a.scoreWeight - b.scoreWeight,
  )[0];
if (best === undefined || !Number.isFinite(best.ndcgAt10)) {
  throw new Error("No validation score.");
}
manifest.ranking = { scoreWeight: best.scoreWeight, retrievalLimit: best.retrievalLimit };
manifest.calibration = {
  selection: "maximum validation-query NDCG@10; ties prefer fewer candidates then lower weight",
  measurements: summary,
};
writeFileSync(`${directory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
// biome-ignore lint/suspicious/noConsole: training command prints validation measurements
console.table(summary);

function signalValue(row: ScoredCandidate, name: string): number {
  return row.signals.find((signal) => signal.name === name)?.value ?? 0;
}
function record(
  measurement: Measurement,
  candidates: readonly ScoredCandidate[],
  grades: ReadonlyMap<string, number>,
) {
  const ranked = candidates
    .filter(
      (row) =>
        !signalValue(row, "learnedRetrievalOnly") ||
        signalValue(row, "twoTowerRank") <= measurement.limit,
    )
    .map((row) => ({
      id: row.item.id,
      score:
        signalValue(row, "crossEncoder") +
        measurement.weight * signalValue(row, "twoTowerSimilarity"),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 50)
    .map((row) => row.id);
  const relevant = new Set([...grades].filter(([, grade]) => grade > 0).map(([id]) => id));
  measurement.ndcg.push(ndcgAt(ranked, grades, 10));
  measurement.mrr.push(mrr(ranked, relevant));
  measurement.recall.push(recallAt(ranked, relevant, 50));
}
