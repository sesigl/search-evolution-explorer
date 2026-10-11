import { bm25Score } from "../index/bm25.ts";
import type { Clock } from "../ports/clock.ts";
import { priceFitScore } from "../signals/price-fit.ts";
import { recencyScore } from "../signals/recency.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import { itemText } from "../text/item-text.ts";
import { termOverlap } from "../text/term-overlap.ts";
import { tokenize } from "../text/tokenize.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { InvertedIndex } from "../types/level.ts";
import type { LeverConfiguration, QueryUnderstanding } from "../types/query.ts";

const TITLE_LENGTH_NORM = 40;

export const FEATURE_NAMES = [
  "bm25",
  "categoryMatch",
  "priceFit",
  "recency",
  "titleQuality",
  "termOverlap",
] as const;

export interface FeatureContext {
  readonly index: InvertedIndex;
  readonly levers: LeverConfiguration;
  readonly clock: Clock;
}

export function extractFeatures(
  understanding: QueryUnderstanding,
  item: CorpusItem,
  context: FeatureContext,
): number[] {
  const rawBm25 = bm25Score(
    understanding.expandedTokens,
    item,
    context.index.documentCount,
    context.index.averageLength,
    context.index.documentFrequency,
    (text) => analyzeDocument(text, context.levers),
  );
  const bm25 = rawBm25 / (1 + rawBm25);
  const categoryMatch =
    understanding.predictedCategoryId !== null &&
    understanding.predictedCategoryId === item.categoryId
      ? 1
      : 0;
  const priceFit = priceFitScore(understanding, item);
  const recency = recencyScore(item.postedAt, context.clock.now().getTime());
  const titleQuality = Math.min(item.title.length / TITLE_LENGTH_NORM, 1);
  return [
    bm25,
    categoryMatch,
    priceFit,
    recency,
    titleQuality,
    termOverlap(understanding.tokens, new Set(tokenize(itemText(item)))),
  ];
}
