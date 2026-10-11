/**
 * Train the two models the position-bias page compares, from the simulated click log.
 *
 * The log in data/clicks.ndjson comes from scripts/simulate-clicks.ts: searchers click a
 * shown listing with probability relevance(WANDS grade) x position decay. The grades are
 * the human answer key, so the clicks and the grades are separate processes. The naive
 * model treats every click as a vote; the corrected model weights each click by
 * 1 / estimated P(click | rank). Both are scored on the evaluated queries plus every
 * listing the log showed.
 *
 * Writes data/models/bias-naive.json and data/models/bias-corrected.json. Refuses to write when
 * the correction does not beat the naive model, so a broken lesson cannot ship.
 *
 * Run:
 *   npm run data:bias-models
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { readJudgments, readLevers, readSessions } from "../src/adapters/artifact-json.ts";
import { hashContent } from "../src/domain/artifacts/manifest.ts";
import { uniqueQueryTexts } from "../src/domain/evaluation/unique-query-texts.ts";
import { buildInvertedIndex } from "../src/domain/index/inverted-index.ts";
import { ndcgWithLogBait } from "../src/domain/ranking/evaluate-ranker.ts";
import { createFeatureLookup } from "../src/domain/ranking/feature-lookup.ts";
import { FEATURE_NAMES } from "../src/domain/ranking/features.ts";
import { pairsFromLog } from "../src/domain/ranking/pairs-from-log.ts";
import { trainPairwise } from "../src/domain/ranking/pairwise-trainer.ts";
import { estimatePropensity } from "../src/domain/ranking/propensity.ts";
import { analyzeDocument } from "../src/domain/text/analyze-document.ts";
import type { CorpusItem } from "../src/domain/types/corpus.ts";
import type { TrainedRankingModel } from "../src/domain/types/level.ts";

const EVAL_NOW = new Date("2026-09-09T00:00:00.000Z");
const TRAINER = { seed: 42, epochs: 16, learningRate: 0.03 };
const PROPENSITY_RANK = 10;
const CLICKS_PATH = "data/clicks.ndjson";
const NAIVE_PATH = resolve("data/models/bias-naive.json");
const CORRECTED_PATH = resolve("data/models/bias-corrected.json");

const items = readFileSync("data/corpus.ndjson", "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line) as CorpusItem);
const judgments = readJudgments("data/judgments.ndjson");
const sessions = readSessions(CLICKS_PATH);
if (sessions.length === 0) {
  process.stderr.write(`Missing ${CLICKS_PATH}. Build it with npm run data:clicks.\n`);
  process.exit(1);
}
const levers = readLevers();
const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
const clock = { now: () => EVAL_NOW };
const featuresFor = createFeatureLookup(items, index, levers, clock);

const teachingQueries = new Set(uniqueQueryTexts(judgments));
const teachingJudgments = judgments.filter((row) => teachingQueries.has(row.queryText));
const teachingSessions = sessions.filter((session) => teachingQueries.has(session.queryText));

const propensity = estimatePropensity(sessions, PROPENSITY_RANK);
const pairs = pairsFromLog(sessions, featuresFor, propensity.estimatedDecay);
const initial = { weights: FEATURE_NAMES.map(() => 0), bias: 0 };
const naiveWeights = trainPairwise(pairs.naive, initial, TRAINER);
const correctedWeights = trainPairwise(pairs.corrected, naiveWeights, TRAINER);

const naiveModel: TrainedRankingModel = {
  variant: "naive",
  featureNames: FEATURE_NAMES,
  weights: naiveWeights.weights,
  bias: naiveWeights.bias,
};
const correctedModel: TrainedRankingModel = {
  variant: "corrected",
  featureNames: FEATURE_NAMES,
  weights: correctedWeights.weights,
  bias: correctedWeights.bias,
};

const naiveNdcg = ndcgWithLogBait(naiveModel, teachingJudgments, teachingSessions, featuresFor);
const correctedNdcg = ndcgWithLogBait(
  correctedModel,
  teachingJudgments,
  teachingSessions,
  featuresFor,
);
if (correctedNdcg <= naiveNdcg) {
  process.stderr.write(
    `Corrected NDCG@10 ${correctedNdcg} did not beat naive ${naiveNdcg}. Refusing to write models.\n`,
  );
  process.exit(1);
}

const clickLogHash = hashContent(readFileSync(CLICKS_PATH, "utf8"));
mkdirSync(dirname(NAIVE_PATH), { recursive: true });
writeFileSync(
  NAIVE_PATH,
  `${JSON.stringify({ ...naiveModel, training: { ...TRAINER, pairCount: pairs.naive.length, clickLogHash } }, null, 2)}\n`,
);
writeFileSync(
  CORRECTED_PATH,
  `${JSON.stringify(
    {
      ...correctedModel,
      training: { ...TRAINER, pairCount: pairs.corrected.length, clickLogHash },
      propensityModel: propensity,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Wrote bias models: naive NDCG@10 ${naiveNdcg.toFixed(4)}, corrected ${correctedNdcg.toFixed(4)} (gap ${
    correctedNdcg - naiveNdcg
  }), sessions ${sessions.length}.\n`,
);
