import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { CorpusItem } from "../src/domain/types/corpus.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_SPAN_DAYS = 90;
const MIN_AGE_BUCKETS = 3;
const MIN_PRICE_SPREAD = 10;
const MIN_CATEGORIES = 8;
const MIN_AMBIGUOUS_CATEGORIES = 2;
const MIN_TERM_LENGTH = 4;
const SOFA = /\bsofa\b/i;
const COUCH = /\bcouch\b/i;
const WORD = /[a-z]{4,}/g;

/**
 * The WANDS corpus is imported, not planted, so these checks assert the properties
 * the lessons depend on rather than specific product ids: a synonym pair, a spread
 * of prices and ages, and at least one word that spans two categories.
 */
export function checkCorpusInvariants(items: readonly CorpusItem[]): void {
  assertNonEmpty(items);
  assertUniqueIds(items);
  assertTitles(items);
  assertCategoryCoverage(items);
  assertSynonymPair(items);
  assertPriceSpread(items);
  assertAgeSpread(items);
  assertAmbiguousTerm(items);
}

function assertNonEmpty(items: readonly CorpusItem[]): void {
  if (items.length === 0) {
    throw new Error("Corpus is empty");
  }
}

function assertUniqueIds(items: readonly CorpusItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Corpus ids are not unique: ${item.id}`);
    }
    ids.add(item.id);
  }
}

function assertTitles(items: readonly CorpusItem[]): void {
  const blank = items.find((item) => item.title.trim() === "");
  if (blank !== undefined) {
    throw new Error(`Corpus item has an empty title: ${blank.id}`);
  }
}

function assertCategoryCoverage(items: readonly CorpusItem[]): void {
  const categories = new Set(items.map((item) => item.categoryId));
  if (categories.size < MIN_CATEGORIES) {
    throw new Error(`Corpus covers only ${categories.size} categories, expected ${MIN_CATEGORIES}`);
  }
}

function assertSynonymPair(items: readonly CorpusItem[]): void {
  const hasSofa = items.some((item) => SOFA.test(item.title));
  const hasCouch = items.some((item) => COUCH.test(item.title));
  if (!(hasSofa && hasCouch)) {
    throw new Error("Corpus is missing a synonym pair (sofa / couch)");
  }
}

function assertPriceSpread(items: readonly CorpusItem[]): void {
  const byCategory = new Map<string, number[]>();
  for (const item of items) {
    const prices = byCategory.get(item.categoryId) ?? [];
    prices.push(item.priceCents);
    byCategory.set(item.categoryId, prices);
  }
  const hasSpread = [...byCategory.values()].some((prices) => {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min > 0 && max / min >= MIN_PRICE_SPREAD;
  });
  if (!hasSpread) {
    throw new Error("Corpus is missing a 10x price spread within a category");
  }
}

function assertAgeSpread(items: readonly CorpusItem[]): void {
  const times = items
    .map((item) => Date.parse(item.postedAt))
    .filter((value) => !Number.isNaN(value));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  if ((maxTime - minTime) / DAY_MS < MIN_AGE_SPAN_DAYS) {
    throw new Error("Corpus postedAt span is under 90 days");
  }
  const buckets = new Set(items.map((item) => ageBucket(Date.parse(item.postedAt), maxTime)));
  if (buckets.size < MIN_AGE_BUCKETS) {
    throw new Error("Corpus does not cover three age buckets");
  }
}

/** A word that appears in two categories is what the ambiguous-query lesson needs. */
function assertAmbiguousTerm(items: readonly CorpusItem[]): void {
  const categoriesByTerm = new Map<string, Set<string>>();
  for (const item of items) {
    for (const term of new Set(item.title.toLowerCase().match(WORD) ?? [])) {
      if (term.length < MIN_TERM_LENGTH) {
        continue;
      }
      const categories = categoriesByTerm.get(term) ?? new Set<string>();
      categories.add(item.categoryId);
      categoriesByTerm.set(term, categories);
    }
  }
  const spans = [...categoriesByTerm.values()].some(
    (categories) => categories.size >= MIN_AMBIGUOUS_CATEGORIES,
  );
  if (!spans) {
    throw new Error("Corpus has no term that spans two categories");
  }
}

function ageBucket(postedMs: number, nowMs: number): string {
  const days = (nowMs - postedMs) / DAY_MS;
  if (days < 30) {
    return "new";
  }
  if (days < 90) {
    return "mid";
  }
  return "old";
}

function readCorpus(path: string): CorpusItem[] {
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as CorpusItem);
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  checkCorpusInvariants(readCorpus(resolve("data/corpus.ndjson")));
  process.stdout.write("Corpus invariants passed.\n");
}
