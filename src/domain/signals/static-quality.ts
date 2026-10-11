import type { Clock } from "../ports/clock.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { recencyScore } from "./recency.ts";

const TITLE_LENGTH_NORM = 40;

export interface StaticQualityScores {
  readonly recency: number;
  readonly titleQuality: number;
  readonly pricePercentile: number;
  readonly total: number;
}

export function computeStaticQuality(
  items: readonly CorpusItem[],
  clock: Clock,
): ReadonlyMap<string, StaticQualityScores> {
  const now = clock.now().getTime();
  const pricesByCategory = pricesByCategoryId(items);
  const result = new Map<string, StaticQualityScores>();
  for (const item of items) {
    const recency = recencyScore(item.postedAt, now);
    const titleQuality = titleQualityScore(item.title);
    const pricePercentile = percentile(
      item.priceCents,
      pricesByCategory.get(item.categoryId) ?? [],
    );
    result.set(item.id, {
      recency,
      titleQuality,
      pricePercentile,
      total: recency + titleQuality + pricePercentile,
    });
  }
  return result;
}

function titleQualityScore(title: string): number {
  return Math.min(title.length / TITLE_LENGTH_NORM, 1);
}

function pricesByCategoryId(items: readonly CorpusItem[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const item of items) {
    const prices = grouped.get(item.categoryId) ?? [];
    prices.push(item.priceCents);
    grouped.set(item.categoryId, prices);
  }
  for (const prices of grouped.values()) {
    prices.sort((left, right) => left - right);
  }
  return grouped;
}

function percentile(priceCents: number, sortedPrices: readonly number[]): number {
  if (sortedPrices.length === 0) {
    return 0;
  }
  const index = sortedPrices.indexOf(priceCents);
  if (index < 0) {
    return 0;
  }
  return index / Math.max(sortedPrices.length - 1, 1);
}
