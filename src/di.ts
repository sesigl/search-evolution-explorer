import { existsSync } from "node:fs";
import { readJudgments, readLevers, readModel, readSessions } from "./adapters/artifact-json.ts";
import { currentInputHash, stateForPath } from "./adapters/artifact-state.ts";
import { createBinaryVectorStore } from "./adapters/binary-vector-store.ts";
import { createFileCorpusSource } from "./adapters/file-corpus-source.ts";
import {
  PRECOMPUTED_RESULTS_PATH,
  type PrecomputedResults,
  readPrecomputedResults,
} from "./adapters/precomputed-results.ts";
import { createSystemClock } from "./adapters/system-clock.ts";
import { createTransformersCrossEncoder } from "./adapters/transformers-cross-encoder.ts";
import { createTransformersQueryEncoder } from "./adapters/transformers-query-encoder.ts";
import { loadTwoTowerArtifact } from "./adapters/two-tower-artifact.ts";
import { codeNotesFor } from "./content/code-notes.ts";
import { hashContent } from "./domain/artifacts/manifest.ts";
import type { CodeModuleView } from "./domain/code/explain-module.ts";
import { explainModule } from "./domain/code/explain-module.ts";
import { listModulePaths, readModuleSource } from "./domain/code/module-registry.ts";
import type { CompareInput, CompareOutput } from "./domain/comparison/compare-levels.ts";
import { compareLevels } from "./domain/comparison/compare-levels.ts";
import { CROSS_ENCODER_ARTIFACT_PATH } from "./domain/cross-encoder/model-spec.ts";
import { type Checkpoint, checkpointFor } from "./domain/evaluation/checkpoint.ts";
import { encodeJudgmentQueries } from "./domain/evaluation/encode-judgment-queries.ts";
import { type GradedRanking, gradeRanking } from "./domain/evaluation/grade-ranking.ts";
import { assembleScorecard } from "./domain/evaluation/scorecard.ts";
import { uniqueQueryTexts } from "./domain/evaluation/unique-query-texts.ts";
import { buildInvertedIndex } from "./domain/index/inverted-index.ts";
import { createRanker as createLevelCanonical } from "./domain/levels/level-1-canonical.ts";
import { createRanker as createLevelEntities } from "./domain/levels/level-1-entities.ts";
import { createRanker as createLevel1 } from "./domain/levels/level-1-lexical.ts";
import { createRanker as createLevelNormalization } from "./domain/levels/level-1-normalization.ts";
import { createRanker as createLevelRecency } from "./domain/levels/level-1-recency.ts";
import { createRanker as createLevelSpelling } from "./domain/levels/level-1-spelling.ts";
import { createRanker as createLevel2, meta as level2 } from "./domain/levels/level-2-boosting.ts";
import { createRanker as createLevel3, meta as level3 } from "./domain/levels/level-3-learned.ts";
import { createRanker as createLevel4 } from "./domain/levels/level-4-hybrid.ts";
import {
  createRanker as createLevel5,
  meta as level5,
} from "./domain/levels/level-5-cross-encoder.ts";
import { createRanker as createLevel6, meta as level6 } from "./domain/levels/level-6-two-tower.ts";
import { levels } from "./domain/levels/level-registry.ts";
import type { LevelSourceView } from "./domain/levels/level-source.ts";
import { resolveLevelSource } from "./domain/levels/level-source.ts";
import type { LevelListItem } from "./domain/levels/list-levels.ts";
import { listLevels } from "./domain/levels/list-levels.ts";
import { readyLevels } from "./domain/levels/ready-levels.ts";
import type { CrossEncoder } from "./domain/ports/cross-encoder.ts";
import type { QueryEncoder } from "./domain/ports/query-encoder.ts";
import { queryTextForEncoding } from "./domain/query-understanding/understand.ts";
import { type BiasLesson, buildBiasLesson } from "./domain/ranking/bias-lesson.ts";
import { createFeatureLookup } from "./domain/ranking/feature-lookup.ts";
import { estimatePropensity } from "./domain/ranking/propensity.ts";
import { UseCaseError } from "./domain/search/errors.ts";
import type { SearchDeps, SearchInput, SearchOutput } from "./domain/search/run-search.ts";
import { runSearch } from "./domain/search/run-search.ts";
import { analyzeDocument } from "./domain/text/analyze-document.ts";
import { TWO_TOWER_PATH } from "./domain/two-tower/model.ts";
import type { TowerTrainingReport } from "./domain/two-tower/training-report.ts";
import type { Scorecard } from "./domain/types/evaluation.ts";
import type {
  AsyncLevelRanker,
  InvertedIndex,
  LevelDeps,
  LevelRanker,
  PrerequisiteState,
} from "./domain/types/level.ts";

export type { LevelSourceView } from "./domain/levels/level-source.ts";
export type { LevelListItem } from "./domain/levels/list-levels.ts";
export type { BiasLesson } from "./domain/ranking/bias-lesson.ts";
export type { SearchInput, SearchOutput } from "./domain/search/run-search.ts";
export type {
  Judgment,
  Scorecard,
  ScorecardRegression,
  ScorecardRun,
} from "./domain/types/evaluation.ts";
export type {
  EvolutionLevel,
  EvolutionLevelSummary,
  LevelDeps,
  LevelRanker,
  TrainedRankingModel,
} from "./domain/types/level.ts";
export type {
  LeverConfiguration,
  LeverOverrides,
  QueryUnderstanding,
  VariantRule,
} from "./domain/types/query.ts";
export type {
  CandidateSet,
  RankedResult,
  RetrievalSignal,
  ScoredCandidate,
} from "./domain/types/ranking.ts";

interface App {
  getTowerTrainingReport(): TowerTrainingReport | null;
  search(input: SearchInput): Promise<SearchOutput>;
  compare(input: CompareInput): Promise<CompareOutput>;
  getLevels(): LevelListItem[];
  /** Number of listings every level searches over. */
  corpusSize(): number;
  getLevelSource(levelId: string): LevelSourceView;
  /** One domain module with links to every function it calls and the authored callouts. */
  getCodeModule(path: string): CodeModuleView;
  getScorecard(levelIds: readonly string[] | undefined): Promise<Scorecard>;
  /** The end of one chapter: its average score against the chapter before it, and for one query. */
  getCheckpoint(levelId: string, queryText: string): Promise<Checkpoint | null>;
  getBiasLesson(): BiasLesson;
  getItemTitle(itemId: string): string;
  /** Grades one level's top 10 for a judged query so the metric can be read row by row. */
  gradeQuery(queryText: string, levelId: string): Promise<GradedRanking>;
  /** Distinct query texts of the judgment set. */
  listJudgedQueries(): string[];
  /** Computes the slow results again, without the precomputed file, for npm run data:precompute. */
  precomputeResults(): Promise<PrecomputedResults>;
}

type RankerFactory = (deps: LevelDeps) => LevelRanker | AsyncLevelRanker;

interface SearchEngine {
  readonly index: InvertedIndex;
  readonly searchDeps: SearchDeps;
}

let cached: Promise<App> | undefined;

export function createApp(): Promise<App> {
  cached ??= buildApp();
  return cached;
}

async function buildApp(): Promise<App> {
  const corpus = createFileCorpusSource("data/corpus.ndjson");
  const items = await corpus.readItems();
  const categories = await corpus.readCategories();
  const clock = createSystemClock();
  const levers = readLevers();
  const correctedModel = readModel("data/models/ranker-corrected.json");
  const biasNaiveModel = readModel("data/models/bias-naive.json");
  const biasCorrectedModel = readModel("data/models/bias-corrected.json");
  const crossEncoder = await loadCrossEncoder();
  const vectorStore = loadVectorStore();
  const encoder = await loadEncoder();
  const towerArtifact = loadTwoTowerArtifact(TWO_TOWER_PATH);
  const corpusHash = currentInputHash("data/corpus.ndjson");
  const clicksHash = currentInputHash("data/clicks.ndjson");
  const encoderReady = encoder !== undefined;
  function artifactState(path: string): PrerequisiteState {
    if (path === TWO_TOWER_PATH) return towerArtifact.state;
    if (path === CROSS_ENCODER_ARTIFACT_PATH && crossEncoder === undefined) {
      return existsSync(path) ? "stale" : "missing";
    }
    return stateForPath(path, encoderReady, corpusHash, clicksHash);
  }
  // Which levels are ready is known from the artifacts alone. The rankers themselves, and the
  // inverted index they share, take seconds to build, so they are built on the first search.
  // Pages that only read precomputed results, the code or the level list never pay for them.
  const rankerFactories = new Map<string, RankerFactory>([
    ["level-1-recency", createLevelRecency],
    ["level-1-normalization", createLevelNormalization],
    ["level-1-lexical", createLevel1],
    ["level-1-spelling", createLevelSpelling],
    ["level-1-entities", createLevelEntities],
    ["level-1-canonical", createLevelCanonical],
    ["level-2-boosting", createLevel2],
  ]);
  if (
    correctedModel !== undefined &&
    artifactState("data/models/ranker-corrected.json") === "ready"
  ) {
    rankerFactories.set("level-3-learned", createLevel3);
  }
  if (
    vectorStore !== undefined &&
    encoder !== undefined &&
    artifactState("data/embeddings.bin") === "ready"
  ) {
    rankerFactories.set("level-4-hybrid", (deps) => createLevel4({ ...deps, vectorStore }));
  }
  if (
    crossEncoder !== undefined &&
    vectorStore !== undefined &&
    encoder !== undefined &&
    level5.prerequisites.every(
      (prerequisite) => artifactState(prerequisite.artifactPath) === "ready",
    )
  ) {
    rankerFactories.set("level-5-cross-encoder", (deps) =>
      createLevel5({ ...deps, vectorStore, crossEncoder }),
    );
    const twoTower = towerArtifact.retrieval;
    if (twoTower !== null) {
      rankerFactories.set(level6.id, (deps) =>
        createLevel6({ ...deps, vectorStore, crossEncoder, twoTower }),
      );
    }
  }
  let engine: SearchEngine | undefined;
  function searchEngine(): SearchEngine {
    if (engine === undefined) {
      const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
      const deps: LevelDeps =
        correctedModel === undefined
          ? { corpus, index, levers, clock }
          : { corpus, index, levers, clock, model: correctedModel };
      const rankers = new Map(
        [...rankerFactories].map(([id, create]) => [id, create(deps)] as const),
      );
      engine = { index, searchDeps: { levels, rankers, levers, clock, categories } };
    }
    return engine;
  }
  const judgments = readJudgments("data/judgments.ndjson");
  const biasSessions = readSessions("data/clicks.ndjson");
  let scorecardQueryVectors: ReadonlyMap<string, Float32Array> | undefined;
  const fingerprint = resultsFingerprint(corpusHash, clicksHash, [...rankerFactories.keys()]);
  const precomputed = usablePrecomputedResults(fingerprint);
  // These results are deterministic for one corpus, so they are computed once per process,
  // or read from the precomputed file when it matches the current code and data.
  let fullScorecard: Promise<Scorecard> | undefined =
    precomputed && Promise.resolve(precomputed.fullScorecard);
  let earlyScorecard: Promise<Scorecard> | undefined =
    precomputed && Promise.resolve(precomputed.earlyScorecard);
  let biasLesson: BiasLesson | undefined = precomputed?.biasLesson;
  function earlyLevelIds(): string[] {
    // Chapters 1-8 do not wait for chapter 9's neural evaluation.
    return readyLevels(levels, (id) => rankerFactories.has(id))
      .filter((level) => level.ordinal < level5.ordinal)
      .map((level) => level.id);
  }
  function computeBiasLesson(): BiasLesson {
    if (
      biasNaiveModel === undefined ||
      biasCorrectedModel === undefined ||
      biasSessions.length === 0
    ) {
      throw new UseCaseError(
        "PRECONDITION_FAILED",
        "Bias lesson artifacts are missing. Rebuild with npm run data:bias-models.",
      );
    }
    return buildBiasLesson({
      naive: biasNaiveModel,
      corrected: biasCorrectedModel,
      judgments,
      sessions: biasSessions,
      propensity: estimatePropensity(biasSessions, 10),
      featuresFor: createFeatureLookup(items, searchEngine().index, levers, clock),
      chapters: { learned: level3.ordinal, boosted: level2.ordinal },
      queryScope: new Set(uniqueQueryTexts(judgments)),
    });
  }
  async function scorecardFor(levelIds: readonly string[] | undefined): Promise<Scorecard> {
    const { searchDeps } = searchEngine();
    scorecardQueryVectors ??= await encodeJudgmentQueries(encoder, judgments, searchDeps.rankers);
    return assembleScorecard(
      levelIds,
      judgments,
      searchDeps,
      scorecardQueryVectors,
      rankerFactories.has(level6.id) ? new Set(towerArtifact.testQueries) : undefined,
    );
  }
  return {
    getTowerTrainingReport() {
      return towerArtifact.report;
    },
    async search(input) {
      requireReady(input.levelId);
      return runSearch(await withQueryVector(input, encoder), searchEngine().searchDeps);
    },
    async compare(input) {
      requireReady(input.leftLevelId);
      requireReady(input.rightLevelId);
      const needsVector =
        needsQueryVector(input.leftLevelId) || needsQueryVector(input.rightLevelId);
      const { searchDeps } = searchEngine();
      if (!needsVector || encoder === undefined) {
        return compareLevels(input, searchDeps);
      }
      const queryVector = await encoder.encode(queryTextForEncoding(input.queryText));
      return compareLevels({ ...input, queryVector }, searchDeps);
    },
    getLevels() {
      return listLevels(levels, artifactState);
    },
    corpusSize() {
      return items.length;
    },
    getLevelSource(levelId) {
      return resolveLevelSource(levelId, levels);
    },
    getCodeModule(path) {
      return explainModule(path, readModuleSource(path), codeNotesFor(path), listModulePaths());
    },
    getScorecard(levelIds) {
      if (levelIds !== undefined && levelIds.length > 0) {
        return scorecardFor(levelIds);
      }
      fullScorecard ??= scorecardFor(undefined);
      return fullScorecard;
    },
    async getCheckpoint(levelId, queryText) {
      const selected = levels.find((level) => level.id === levelId);
      if (selected !== undefined && selected.ordinal < level5.ordinal) {
        earlyScorecard ??= scorecardFor(earlyLevelIds());
        return checkpointFor(await earlyScorecard, levels, levelId, queryText);
      }
      fullScorecard ??= scorecardFor(undefined);
      return checkpointFor(await fullScorecard, levels, levelId, queryText);
    },
    getBiasLesson() {
      biasLesson ??= computeBiasLesson();
      return biasLesson;
    },
    async precomputeResults() {
      return {
        fingerprint,
        fullScorecard: await scorecardFor(undefined),
        earlyScorecard: await scorecardFor(earlyLevelIds()),
        biasLesson: computeBiasLesson(),
      };
    },
    getItemTitle(itemId) {
      return items.find((item) => item.id === itemId)?.title ?? itemId;
    },
    async gradeQuery(queryText, levelId) {
      requireReady(levelId);
      if (!judgments.some((judgment) => judgment.queryText === queryText)) {
        throw new UseCaseError("BAD_REQUEST", "This query is not in the judgment set.");
      }
      const output = await runSearch(
        await withQueryVector({ queryText, levelId, limit: 10 }, encoder),
        searchEngine().searchDeps,
      );
      return gradeRanking(
        queryText,
        levelId,
        output.results,
        judgments,
        (itemId) => items.find((item) => item.id === itemId)?.title ?? itemId,
      );
    },
    listJudgedQueries() {
      return uniqueQueryTexts(judgments);
    },
  };

  function requireReady(levelId: string): void {
    const selected = listLevels(levels, artifactState).find((level) => level.id === levelId);
    if (selected?.implemented && selected.unavailableReason !== null) {
      throw new UseCaseError("PRECONDITION_FAILED", selected.unavailableReason);
    }
  }
}

async function withQueryVector(
  input: SearchInput,
  encoder: QueryEncoder | undefined,
): Promise<SearchInput> {
  if (!needsQueryVector(input.levelId) || encoder === undefined) {
    return input;
  }
  const queryVector = await encoder.encode(queryTextForEncoding(input.queryText));
  return { ...input, queryVector };
}

/** Small inputs of the precomputed results. The corpus and click log enter through their hashes. */
const PRECOMPUTED_INPUT_FILES = [
  "data/judgments.ndjson",
  "data/logged-ranking.ndjson",
  "data/levers/stopwords.json",
  "data/levers/synonyms.json",
  "data/levers/variants.json",
  "data/models/ranker-corrected.json",
  "data/models/bias-naive.json",
  "data/models/bias-corrected.json",
  TWO_TOWER_PATH,
];

/** Names the domain code, data and ready levels that the precomputed results depend on. */
function resultsFingerprint(
  corpusHash: string,
  clicksHash: string,
  readyLevelIds: readonly string[],
): string {
  const sources = [...listModulePaths()]
    .sort()
    .map((path) => `${path}:${hashContent(readModuleSource(path))}`);
  const files = PRECOMPUTED_INPUT_FILES.map((path) => `${path}:${currentInputHash(path)}`);
  return hashContent(
    JSON.stringify({
      sources,
      files,
      corpusHash,
      clicksHash,
      readyLevelIds: [...readyLevelIds].sort(),
    }),
  );
}

function usablePrecomputedResults(fingerprint: string): PrecomputedResults | undefined {
  const results = readPrecomputedResults(PRECOMPUTED_RESULTS_PATH);
  if (results === undefined || results.fingerprint === fingerprint) {
    return results;
  }
  // biome-ignore lint/suspicious/noConsole: a stale file is an operator problem, not a user error
  console.warn(
    `${PRECOMPUTED_RESULTS_PATH} does not match the current code and data. Computing results live. Run npm run data:precompute.`,
  );
}

/** Levels whose candidate set is built from precomputed document vectors. */
const VECTOR_LEVELS = new Set(["level-4-hybrid", "level-5-cross-encoder", "level-6-two-tower"]);

function needsQueryVector(levelId: string): boolean {
  return VECTOR_LEVELS.has(levelId);
}

function loadVectorStore() {
  const binPath = "data/embeddings.bin";
  const manifestPath = "data/embeddings.manifest.json";
  if (!(existsSync(binPath) && existsSync(manifestPath))) {
    return;
  }
  return createBinaryVectorStore(binPath, manifestPath);
}

async function loadEncoder(): Promise<QueryEncoder | undefined> {
  try {
    return await createTransformersQueryEncoder(".cache");
  } catch {
    return undefined;
  }
}

async function loadCrossEncoder(): Promise<CrossEncoder | undefined> {
  if (!existsSync(CROSS_ENCODER_ARTIFACT_PATH)) {
    return;
  }
  try {
    return await createTransformersCrossEncoder(".cache", true);
  } catch {
    return undefined;
  }
}
