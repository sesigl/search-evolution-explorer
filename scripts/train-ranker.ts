import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { readSessions } from "../src/adapters/artifact-json.ts";
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
import type { Judgment } from "../src/domain/types/evaluation.ts";
import type { TrainedRankingModel } from "../src/domain/types/level.ts";
import type { LeverConfiguration, VariantRule } from "../src/domain/types/query.ts";

const EVAL_NOW = new Date("2026-09-09T00:00:00.000Z");
const TRAINER = { seed: 42, epochs: 16, learningRate: 0.03 };
const MAX_PROPENSITY_RANK = 100;
const NAIVE_PATH = resolve("data/models/ranker-naive.json");
const CORRECTED_PATH = resolve("data/models/ranker-corrected.json");

function requireUtf8(path: string, rebuildCommand: string): string {
  if (!existsSync(path)) {
    process.stderr.write(`Missing ${path}. Rebuild with ${rebuildCommand}.\n`);
    process.exit(1);
  }
  return readFileSync(path, "utf8");
}

function readNdjson<T>(path: string, rebuildCommand: string): T[] {
  return requireUtf8(path, rebuildCommand)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as T);
}

function loadLevers(): LeverConfiguration {
  return {
    stopWords: JSON.parse(readFileSync("data/levers/stopwords.json", "utf8")) as string[],
    synonymGroups: JSON.parse(readFileSync("data/levers/synonyms.json", "utf8")) as string[][],
    variantRules: JSON.parse(readFileSync("data/levers/variants.json", "utf8")) as VariantRule[],
  };
}

const items = readNdjson<CorpusItem>("data/corpus.ndjson", "npm run data:corpus");
const judgments = readNdjson<Judgment>("data/judgments.ndjson", "npm run data:clicks");
const sessions = readSessions("data/clicks.ndjson");
if (sessions.length === 0) {
  process.stderr.write("Missing data/clicks.ndjson. Rebuild with npm run data:clicks.\n");
  process.exit(1);
}
const levers = loadLevers();
const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
const clock = { now: () => EVAL_NOW };
const featuresFor = createFeatureLookup(items, index, levers, clock);

// The bias gate is measured on the curated teaching queries, the same set the
// app shows in the bias lesson. See buildBiasLesson for why the filler queries
// are excluded.
const teachingQueries = new Set(uniqueQueryTexts(judgments));
const teachingJudgments = judgments.filter((row) => teachingQueries.has(row.queryText));
const teachingSessions = sessions.filter((session) => teachingQueries.has(session.queryText));

const longestShown = sessions.reduce(
  (longest, session) => Math.max(longest, session.shownItemIds.length),
  1,
);
const propensity = estimatePropensity(sessions, Math.min(MAX_PROPENSITY_RANK, longestShown));
const pairs = pairsFromLog(sessions, featuresFor, propensity.estimatedDecay);
const initial = { weights: FEATURE_NAMES.map(() => 0), bias: 0 };
// Both variants get the same optimizer budget so the comparison isolates the
// effect of the propensity weights, not the effect of training longer.
const naiveWeights = trainPairwise(pairs.naive, initial, TRAINER);
const correctedWeights = trainPairwise(pairs.corrected, naiveWeights, TRAINER);
const clickLogHash = hashContent(readFileSync("data/clicks.ndjson", "utf8"));

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
  `Wrote naive NDCG@10 ${naiveNdcg.toFixed(4)} and corrected ${correctedNdcg.toFixed(4)} (gap ${
    correctedNdcg - naiveNdcg
  }).\n`,
);
