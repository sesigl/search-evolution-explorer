/**
 * Simulate a click log from the WANDS human grades and the chapter 2 ranking.
 *
 * The logging policy shows the chapter 2 order. A searcher clicks a shown listing with
 * probability relevance(grade) x positionDecay(rank). Because a high position still
 * earns clicks for a weakly relevant listing, the log carries position bias by
 * construction, and inverse propensity scoring can correct it. The grades are the
 * WANDS human labels, so the answer key and the click log are separate processes.
 *
 * Writes data/clicks.ndjson, data/clicks.manifest.json and data/logged-ranking.ndjson.
 * The answer key lives in data/judgments.ndjson and is written by import-wands.ts.
 *
 * Run: npm run data:clicks
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { readJudgments, readLevers } from "../src/adapters/artifact-json.ts";
import { hashContent } from "../src/domain/artifacts/manifest.ts";
import { uniqueQueryTexts } from "../src/domain/evaluation/unique-query-texts.ts";
import { buildInvertedIndex } from "../src/domain/index/inverted-index.ts";
import { createRanker as createLevel2 } from "../src/domain/levels/level-2-boosting.ts";
import { understand } from "../src/domain/query-understanding/understand.ts";
import { POSITION_DECAY_DESCRIPTION } from "../src/domain/simulation/position-decay.ts";
import { sampleSessions } from "../src/domain/simulation/session-sampler.ts";
import { compareScoreThenId } from "../src/domain/sort-score.ts";
import { analyzeDocument } from "../src/domain/text/analyze-document.ts";
import type { CorpusItem } from "../src/domain/types/corpus.ts";
import type { Judgment } from "../src/domain/types/evaluation.ts";
import type { LevelDeps, LevelRanker } from "../src/domain/types/level.ts";
import type { QueryUnderstanding } from "../src/domain/types/query.ts";

const SESSION_COUNT = 50_000;
const SEED = 42;
const SHOWN_LIMIT = 200;
/** An irrelevant listing still earns the occasional click at a high position. */
const CLICK_FLOOR = 0.03;
const CORPUS_PATH = resolve("data/corpus.ndjson");
const JUDGMENTS_PATH = resolve("data/judgments.ndjson");
const CLICKS_PATH = resolve("data/clicks.ndjson");
const CLICKS_MANIFEST_PATH = resolve("data/clicks.manifest.json");
const RANKING_PATH = resolve("data/logged-ranking.ndjson");

function readCorpus(path: string): CorpusItem[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as CorpusItem);
}

function gradeKey(queryText: string, itemId: string): string {
  return `${queryText}\0${itemId}`;
}

function gradeMap(judgments: readonly Judgment[]): Map<string, number> {
  const grades = new Map<string, number>();
  for (const judgment of judgments) {
    grades.set(gradeKey(judgment.queryText, judgment.itemId), judgment.grade);
  }
  return grades;
}

function rankedMatches(
  boostingRanker: LevelRanker,
  understanding: QueryUnderstanding,
): CorpusItem[] {
  return boostingRanker
    .match(understanding)
    .items.map((item) => ({ item, score: boostingRanker.score(understanding, item).score }))
    .sort((left, right) =>
      compareScoreThenId([left.item.id, left.score], [right.item.id, right.score]),
    )
    .slice(0, SHOWN_LIMIT)
    .map((row) => row.item);
}

const items = readCorpus(CORPUS_PATH);
const judgments = readJudgments(JUDGMENTS_PATH);
const levers = readLevers();
const queries = uniqueQueryTexts(judgments);
const grades = gradeMap(judgments);

const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
const clock = { now: () => new Date("2026-09-09T00:00:00.000Z") };
const deps: LevelDeps = {
  corpus: { readItems: async () => items, readCategories: async () => [] },
  index,
  levers,
  clock,
};
const ranker = createLevel2(deps);

const shownByQuery = new Map<string, CorpusItem[]>();
for (const queryText of queries) {
  const understanding = understand(queryText, levers, {}, []);
  shownByQuery.set(queryText, rankedMatches(ranker, understanding));
}

const sessions = sampleSessions({
  queries,
  shownByQuery,
  relevanceFor: (queryText, itemId) => {
    const grade = grades.get(gradeKey(queryText, itemId)) ?? 0;
    return CLICK_FLOOR + (1 - CLICK_FLOOR) * (Math.min(grade, 3) / 3);
  },
  sessionCount: SESSION_COUNT,
  seed: SEED,
});

mkdirSync(dirname(CLICKS_PATH), { recursive: true });
writeFileSync(
  RANKING_PATH,
  `${queries
    .map((queryText) =>
      JSON.stringify({
        queryText,
        shownItemIds: (shownByQuery.get(queryText) ?? []).map((item) => item.id),
      }),
    )
    .join("\n")}\n`,
);
writeFileSync(
  CLICKS_PATH,
  `${sessions
    .map((row) =>
      JSON.stringify({
        sessionId: row.sessionId,
        queryText: row.queryText,
        clickedItemIds: row.clickedItemIds,
      }),
    )
    .join("\n")}\n`,
);
writeFileSync(
  CLICKS_MANIFEST_PATH,
  `${JSON.stringify(
    {
      seed: SEED,
      sessionCount: sessions.length,
      queryCount: queries.length,
      positionDecayDescription: POSITION_DECAY_DESCRIPTION,
      clickModel: `relevance x position decay; relevance = ${CLICK_FLOOR} + (1 - ${CLICK_FLOOR}) x grade / 3`,
      relevanceSource: "WANDS human labels (Exact=3, Partial=1, Irrelevant=0)",
      loggingPolicy:
        "Chapter 2 (lexical + normalization) ranks every matching listing. Sessions examine the full list with 1/rank decay.",
      corpusHash: hashContent(readFileSync(CORPUS_PATH, "utf8")),
      judgmentsHash: hashContent(readFileSync(JUDGMENTS_PATH, "utf8")),
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `Wrote ${sessions.length} sessions over ${queries.length} queries to ${CLICKS_PATH}.\n`,
);
