import { uniqueQueryTexts } from "../evaluation/unique-query-texts.ts";
import type { SimulatedSession } from "../simulation/session-sampler.ts";
import type { Judgment } from "../types/evaluation.ts";
import type { TrainedRankingModel } from "../types/level.ts";
import { judgmentsWithLogBait, ndcgOnJudgments } from "./evaluate-ranker.ts";
import { linearScore } from "./linear-scorer.ts";
import type { PropensityModel } from "./propensity.ts";

const CORRECTION_TECHNIQUE =
  "Inverse propensity scoring: each training pair is weighted by 1 / estimated P(click | rank), used as a proxy for P(examine | rank).";
const DEFAULT_LAB_QUERIES = 3;
const DEFAULT_LAB_PAGE_SIZE = 10;
const DEFAULT_OVER_RANKED = 8;

interface BiasModelMetrics {
  readonly ndcgAt10: number;
}

interface BiasChapterOrdinals {
  /** Ordinal of the learned-ranking chapter that trains on the click log. */
  readonly learned: number;
  /** Ordinal of the hand-tuned chapter whose ranking wrote the log. */
  readonly boosted: number;
}

/** One listing of the log's first page, with both models' scores. */
export interface BiasLogItem {
  readonly itemId: string;
  readonly logPosition: number;
  readonly clicks: number;
  readonly sessions: number;
  readonly grade: number;
  readonly naiveScore: number;
  readonly correctedScore: number;
}

export interface BiasLogExample {
  readonly queryText: string;
  readonly items: readonly BiasLogItem[];
}

/** A grade-0 listing that searchers still clicked because the log showed it high. */
interface BiasClickedBaitExample {
  readonly queryText: string;
  readonly itemId: string;
  readonly logPosition: number;
  readonly clicks: number;
  readonly sessions: number;
  readonly grade: number;
}

/**
 * Same inputs as the running app, plus the chapter numbers the page refers to.
 * Both the log and the shipped scorecard are measured in the app, so the page
 * never hard-codes a chapter number that could drift.
 */
export interface BiasLessonInput {
  readonly naive: TrainedRankingModel;
  readonly corrected: TrainedRankingModel;
  readonly judgments: readonly Judgment[];
  readonly sessions: readonly SimulatedSession[];
  readonly propensity: PropensityModel;
  readonly featuresFor: (queryText: string, itemId: string) => number[] | undefined;
  readonly chapters: BiasChapterOrdinals;
  /**
   * The queries the lesson is scored on. The app passes the judged WANDS
   * queries: their labels carry a real signal, and the click log covers the same
   * queries, so the lesson is measured on the data it was built from.
   */
  readonly queryScope?: ReadonlySet<string>;
  readonly labQueryLimit?: number;
  readonly labPageSize?: number;
  readonly baitLimit?: number;
}

export interface BiasLesson {
  readonly naive: BiasModelMetrics;
  readonly corrected: BiasModelMetrics;
  /** Number of judged test queries both models are measured on. */
  readonly queryCount: number;
  readonly gap: number;
  readonly chapters: BiasChapterOrdinals;
  /** Click-through rate by result position: estimatedDecay[0] is position 1. */
  readonly propensity: {
    readonly estimatedDecay: readonly number[];
  };
  /** Facts about the click log, so the page can describe the data instead of hiding it. */
  readonly dataDisclosure: {
    readonly sessionCount: number;
    readonly clickCount: number;
    readonly queryCount: number;
    readonly positionCount: number;
  };
  /** One ranked page per query, so the reader can re-rank it under both models. */
  readonly logExamples: readonly BiasLogExample[];
  /** Grade-0 listings the log showed high and searchers clicked anyway. */
  readonly clickedBaitExamples: readonly BiasClickedBaitExample[];
  readonly correctionTechnique: string;
}

interface ShownRow {
  readonly queryText: string;
  readonly itemId: string;
  readonly logPosition: number;
  readonly grade: number;
  readonly clicks: number;
  readonly sessions: number;
}

interface ScoredRow extends ShownRow {
  readonly naiveScore: number;
  readonly correctedScore: number;
}

function rowKey(queryText: string, itemId: string): string {
  return `${queryText}\0${itemId}`;
}

export function buildBiasLesson(input: BiasLessonInput): BiasLesson {
  const { queryScope } = input;
  const scopedJudgments =
    queryScope === undefined
      ? input.judgments
      : input.judgments.filter((judgment) => queryScope.has(judgment.queryText));
  const scopedSessions =
    queryScope === undefined
      ? input.sessions
      : input.sessions.filter((session) => queryScope.has(session.queryText));
  const graded = judgmentsWithLogBait(scopedJudgments, scopedSessions);
  const naiveMetrics = metricsFor(input.naive, graded, input.featuresFor);
  const correctedMetrics = metricsFor(input.corrected, graded, input.featuresFor);

  const pageSize = input.labPageSize ?? DEFAULT_LAB_PAGE_SIZE;
  const rows = scoredRows(
    shownRows(scopedSessions, gradeIndex(graded), pageSize),
    input.naive,
    input.corrected,
    input.featuresFor,
  );
  const baits = clickedBait(rows);

  return {
    naive: naiveMetrics,
    corrected: correctedMetrics,
    queryCount: uniqueQueryTexts(scopedJudgments).length,
    gap: correctedMetrics.ndcgAt10 - naiveMetrics.ndcgAt10,
    chapters: input.chapters,
    propensity: {
      estimatedDecay: input.propensity.estimatedDecay,
    },
    dataDisclosure: {
      sessionCount: scopedSessions.length,
      clickCount: scopedSessions.reduce(
        (total, session) => total + session.clickedItemIds.length,
        0,
      ),
      queryCount: new Set(scopedSessions.map((session) => session.queryText)).size,
      positionCount: input.propensity.estimatedDecay.length,
    },
    logExamples: buildLogExamples(rows, baits, input.labQueryLimit ?? DEFAULT_LAB_QUERIES),
    clickedBaitExamples: baits.slice(0, input.baitLimit ?? DEFAULT_OVER_RANKED),
    correctionTechnique: CORRECTION_TECHNIQUE,
  };
}

function gradeIndex(judgments: readonly Judgment[]): Map<string, number> {
  const grades = new Map<string, number>();
  for (const judgment of judgments) {
    grades.set(rowKey(judgment.queryText, judgment.itemId), judgment.grade);
  }
  return grades;
}

/** Groups sessions by query and counts clicks, so the lab can show the log's first page. */
function shownRows(
  sessions: readonly SimulatedSession[],
  grades: ReadonlyMap<string, number>,
  pageSize: number,
): ShownRow[] {
  const byQuery = new Map<string, SimulatedSession[]>();
  for (const session of sessions) {
    const group = byQuery.get(session.queryText);
    if (group === undefined) {
      byQuery.set(session.queryText, [session]);
    } else {
      group.push(session);
    }
  }
  const rows: ShownRow[] = [];
  for (const [queryText, group] of byQuery) {
    const shown = group[0]?.shownItemIds ?? [];
    const clicks = new Map<string, number>();
    for (const session of group) {
      for (const itemId of session.clickedItemIds) {
        clicks.set(itemId, (clicks.get(itemId) ?? 0) + 1);
      }
    }
    shown.slice(0, pageSize).forEach((itemId, index) => {
      rows.push({
        queryText,
        itemId,
        logPosition: index + 1,
        grade: grades.get(rowKey(queryText, itemId)) ?? 0,
        clicks: clicks.get(itemId) ?? 0,
        sessions: group.length,
      });
    });
  }
  return rows;
}

function scoredRows(
  rows: readonly ShownRow[],
  naive: TrainedRankingModel,
  corrected: TrainedRankingModel,
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
): ScoredRow[] {
  return rows.flatMap((row) => {
    const features = featuresFor(row.queryText, row.itemId);
    if (features === undefined) {
      return [];
    }
    return [
      {
        ...row,
        naiveScore: linearScore(naive, features),
        correctedScore: linearScore(corrected, features),
      },
    ];
  });
}

function clickedBait(rows: readonly ScoredRow[]): BiasClickedBaitExample[] {
  const baits: BiasClickedBaitExample[] = [];
  for (const row of rows) {
    if (row.grade === 0 && row.clicks > 0) {
      baits.push({
        queryText: row.queryText,
        itemId: row.itemId,
        logPosition: row.logPosition,
        clicks: row.clicks,
        sessions: row.sessions,
        grade: row.grade,
      });
    }
  }
  baits.sort(
    (left, right) =>
      right.clicks - left.clicks ||
      left.logPosition - right.logPosition ||
      left.queryText.localeCompare(right.queryText) ||
      left.itemId.localeCompare(right.itemId),
  );
  return baits;
}

function buildLogExamples(
  rows: readonly ScoredRow[],
  baits: readonly BiasClickedBaitExample[],
  limit: number,
): BiasLogExample[] {
  const baitCounts = new Map<string, number>();
  for (const entry of baits) {
    baitCounts.set(entry.queryText, (baitCounts.get(entry.queryText) ?? 0) + 1);
  }
  const byQuery = new Map<string, BiasLogItem[]>();
  const relevant = new Map<string, number>();
  for (const row of rows) {
    const item: BiasLogItem = {
      itemId: row.itemId,
      logPosition: row.logPosition,
      clicks: row.clicks,
      sessions: row.sessions,
      grade: row.grade,
      naiveScore: row.naiveScore,
      correctedScore: row.correctedScore,
    };
    const group = byQuery.get(row.queryText);
    if (group === undefined) {
      byQuery.set(row.queryText, [item]);
    } else {
      group.push(item);
    }
    if (row.grade > 0) {
      relevant.set(row.queryText, (relevant.get(row.queryText) ?? 0) + 1);
    }
  }
  const baitCount = (queryText: string) => baitCounts.get(queryText) ?? 0;
  const relevantCount = (queryText: string) => relevant.get(queryText) ?? 0;
  // Prefer a query that shows both a relevant listing and a clicked grade-0 one, so the
  // lab has something to contrast; then the most clicked bait, then the most relevant items.
  const mixed = (queryText: string) => baitCount(queryText) > 0 && relevantCount(queryText) > 0;
  const queries = [...byQuery.keys()];
  queries.sort((left, right) => {
    const byMix = Number(mixed(right)) - Number(mixed(left));
    if (byMix !== 0) {
      return byMix;
    }
    const byBait = baitCount(right) - baitCount(left);
    if (byBait !== 0) {
      return byBait;
    }
    const byRelevant = relevantCount(right) - relevantCount(left);
    return byRelevant === 0 ? left.localeCompare(right) : byRelevant;
  });
  return queries.slice(0, limit).map((queryText) => ({
    queryText,
    items: byQuery.get(queryText) ?? [],
  }));
}

function metricsFor(
  model: TrainedRankingModel,
  judgments: readonly Judgment[],
  featuresFor: (queryText: string, itemId: string) => number[] | undefined,
): BiasModelMetrics {
  return { ndcgAt10: ndcgOnJudgments(model, judgments, featuresFor) };
}
