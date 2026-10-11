/**
 * Import the pinned WANDS (Wayfair ANnotation Dataset) into the app's data files.
 *
 * Source: https://github.com/wayfair/WANDS (MIT). Download the release once into
 * data/wands/ (not committed). The committed outputs are the source of truth:
 *   data/corpus.ndjson      one row per WANDS product, mapped to CorpusItem
 *   data/judgments.ndjson   WANDS human labels for the evaluated queries
 *
 * Mapping (documented, no hidden rules):
 *   Exact -> 3, Partial -> 1, Irrelevant -> 0 (dropped; the app treats a missing
 *   pair as 0). WANDS has no price and no date, so `priceCents` and `postedAt`
 *   are deterministic synthetic overlay columns derived from the product id.
 *   They are teaching fixtures for the price and recency chapters, and the
 *   corpus manifest marks them as synthetic.
 *
 * Run: node scripts/import-wands.ts [--max-queries 240]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import type { CorpusItem } from "../src/domain/types/corpus.ts";

const WANDS_DIR = resolve("data/wands");
const CORPUS_PATH = resolve("data/corpus.ndjson");
const CORPUS_MANIFEST_PATH = resolve("data/corpus.manifest.json");
const JUDGMENTS_PATH = resolve("data/judgments.ndjson");
const JUDGMENTS_MANIFEST_PATH = resolve("data/judgments.manifest.json");

/** Fixed clock for the synthetic recency overlay, so builds are reproducible. */
const EVAL_NOW = Date.UTC(2026, 8, 9);
const RECENCY_SPAN_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EXACT = 3;
const MIN_IRRELEVANT = 5;
const DEFAULT_MAX_QUERIES = 240;

/** Realistic price bands per top-level category, in cents. FNV lane 1 picks the price. */
const PRICE_BANDS: ReadonlyMap<string, readonly [number, number]> = new Map([
  ["Furniture", [3000, 200_000]],
  ["Décor & Pillows", [1000, 30_000]],
  ["Home Improvement", [500, 80_000]],
  ["Outdoor", [3000, 150_000]],
  ["Storage & Organization", [2000, 60_000]],
  ["Lighting", [1500, 50_000]],
  ["Rugs", [2000, 90_000]],
  ["Bed & Bath", [1000, 40_000]],
  ["Kitchen & Tabletop", [500, 40_000]],
  ["Baby & Kids", [1000, 60_000]],
  ["Appliances", [5000, 150_000]],
]);

/**
 * Queries the evaluated set always keeps, so every chapter has a live example.
 * The reason is for the reviewer, not the app.
 */
const ALWAYS_INCLUDED: readonly { readonly id: string; readonly reason: string }[] = [
  { id: "149", reason: "normalization: mid century vs mid-century" },
  { id: "286", reason: "normalization: mid-century spelling" },
  { id: "453", reason: "normalization: midcentury joined form" },
  { id: "305", reason: "spelling: ligth -> light, many exact matches" },
  { id: "191", reason: "spelling: biycicle -> bicycle" },
  { id: "485", reason: "spelling: pedistole -> pedestal" },
  { id: "20", reason: "spelling: foutains -> fountains" },
  { id: "360", reason: "synonym: sofa" },
  { id: "269", reason: "synonym: couch" },
  { id: "244", reason: "synonym: loveseat" },
  { id: "148", reason: "ambiguity: bare industrial" },
  { id: "91", reason: "ambiguity: industrial pipe dining table" },
  { id: "15", reason: "attributes: brand, colour and storage in one query" },
  { id: "26", reason: "attributes: material" },
  { id: "31", reason: "attributes: colour" },
  { id: "213", reason: "attributes: model number" },
];

const WHITESPACE = /\s+/g;
const PARENS = /[()]/g;

interface Row {
  readonly [column: string]: string;
}

interface QueryLabelCounts {
  exact: number;
  partial: number;
  irrelevant: number;
}

function readFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value === undefined ? fallback : Number(value);
}

interface ParsedField {
  readonly value: string;
  readonly next: number;
}

/** Read one field from `start` up to the next unquoted delimiter or newline. */
function readField(text: string, start: number, delimiter: string): ParsedField {
  let value = "";
  let index = start;
  let quoted = false;
  while (index < text.length) {
    const char = text[index] ?? "";
    const escapedQuote = quoted && char === '"' && text[index + 1] === '"';
    if (escapedQuote) {
      value += '"';
      index += 2;
    } else if (char === '"') {
      quoted = !quoted;
      index += 1;
    } else if (!quoted && isTerminator(char, delimiter)) {
      break;
    } else {
      value += char === "\r" ? "" : char;
      index += 1;
    }
  }
  return { value, next: index };
}

function isTerminator(char: string, delimiter: string): boolean {
  return char === delimiter || char === "\n";
}

/** RFC 4180 delimited parser: handles quoted fields, embedded delimiters and newlines. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  if (text === "") {
    return rows;
  }
  let row: string[] = [];
  let index = 0;
  while (index < text.length) {
    const field = readField(text, index, delimiter);
    row.push(field.value);
    const terminator = text[field.next] ?? "";
    if (terminator === delimiter) {
      index = field.next + 1;
      continue;
    }
    rows.push(row);
    row = [];
    index = field.next + 1;
    if (terminator !== "\n") {
      break;
    }
  }
  return rows;
}

function readTable(path: string): Row[] {
  if (!existsSync(path)) {
    process.stderr.write(`Missing ${path}. Download the WANDS release there first.\n`);
    process.exit(1);
  }
  const table = parseDelimited(readFileSync(path, "utf8"), "\t");
  const header = table[0] ?? [];
  const rows: Row[] = [];
  for (const cells of table.slice(1)) {
    if (cells.length <= 1 && (cells[0] ?? "") === "") {
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((column, index) => {
      row[column] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

/** Uniform value for a lane from a SHA-256 digest, so overlays spread over their band. */
function hashedUnit(key: string, lane: number): number {
  const digest = createHash("sha256").update(`${lane}:${key}`).digest();
  return digest.readUInt32BE(0) / 4_294_967_296;
}

function topCategory(row: Row): string {
  const hierarchy = (row["category hierarchy"] ?? "").split("/")[0]?.trim() ?? "";
  if (hierarchy !== "") {
    return hierarchy;
  }
  const productClass = (row["product_class"] ?? "").trim();
  return productClass === "" ? "Other" : productClass;
}

/** Turn `color : champagne|primarymaterial : wood|casters : no` into readable words. */
function featureWords(features: string): string {
  const words: string[] = [];
  for (const part of features.split("|")) {
    const colon = part.indexOf(":");
    const value = (colon === -1 ? part : part.slice(colon + 1)).trim().toLowerCase();
    if (value === "" || value === "no" || value === "yes" || value === "n/a") {
      continue;
    }
    words.push(value.replace(PARENS, " "));
  }
  return words.join(" ");
}

function describe(row: Row): string {
  const description = (row["product_description"] ?? "").trim();
  const features = featureWords(row["product_features"] ?? "");
  return `${description} ${features}`.replace(WHITESPACE, " ").trim().slice(0, 600);
}

function syntheticPriceCents(productId: string, categoryId: string): number {
  const [min, max] = PRICE_BANDS.get(categoryId) ?? [1000, 80_000];
  return Math.round(min + hashedUnit(`price:${productId}`, 1) * (max - min));
}

function syntheticPostedAt(productId: string): string {
  const days = Math.floor(hashedUnit(`age:${productId}`, 2) * RECENCY_SPAN_DAYS);
  return new Date(EVAL_NOW - days * DAY_MS).toISOString();
}

function toCorpusItem(row: Row): CorpusItem {
  const productId = row["product_id"] ?? "";
  const categoryId = topCategory(row);
  return {
    id: `wands-${productId}`,
    title: (row["product_name"] ?? "").trim(),
    description: describe(row),
    categoryId,
    priceCents: syntheticPriceCents(productId, categoryId),
    location: "Berlin",
    postedAt: syntheticPostedAt(productId),
    available: true,
  };
}

function queryTextsById(queryRows: readonly Row[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of queryRows) {
    map.set(row["query_id"] ?? "", (row["query"] ?? "").trim());
  }
  return map;
}

function labelCounts(labelRows: readonly Row[]): Map<string, QueryLabelCounts> {
  const byQuery = new Map<string, QueryLabelCounts>();
  for (const row of labelRows) {
    const queryId = row["query_id"] ?? "";
    const entry = byQuery.get(queryId) ?? { exact: 0, partial: 0, irrelevant: 0 };
    if (row["label"] === "Exact") {
      entry.exact += 1;
    } else if (row["label"] === "Partial") {
      entry.partial += 1;
    } else {
      entry.irrelevant += 1;
    }
    byQuery.set(queryId, entry);
  }
  return byQuery;
}

function selectQueryIds(
  counts: ReadonlyMap<string, QueryLabelCounts>,
  maxQueries: number,
): string[] {
  const always = new Set(ALWAYS_INCLUDED.map((entry) => entry.id));
  const balanced: string[] = [];
  for (const [queryId, count] of counts) {
    if (!always.has(queryId) && count.exact >= MIN_EXACT && count.irrelevant >= MIN_IRRELEVANT) {
      balanced.push(queryId);
    }
  }
  balanced.sort((left, right) => Number(left) - Number(right));
  const selected = new Set([...balanced.slice(0, maxQueries), ...always]);
  return [...selected].sort((left, right) => Number(left) - Number(right));
}

function requireQueryText(queryTexts: ReadonlyMap<string, string>, queryId: string): string {
  const text = queryTexts.get(queryId);
  if (text === undefined || text === "") {
    process.stderr.write(`WANDS is missing query id ${queryId}.\n`);
    process.exit(1);
  }
  return text;
}

interface Judgment {
  readonly queryText: string;
  readonly itemId: string;
  readonly grade: 3 | 1;
}

function buildJudgments(
  selectedIds: readonly string[],
  queryTexts: ReadonlyMap<string, string>,
  labelRows: readonly Row[],
  knownItemIds: ReadonlySet<string>,
): Judgment[] {
  const selected = new Set(selectedIds);
  const judgments: Judgment[] = [];
  for (const row of labelRows) {
    const queryId = row["query_id"] ?? "";
    if (!selected.has(queryId) || (row["label"] !== "Exact" && row["label"] !== "Partial")) {
      continue;
    }
    const itemId = `wands-${row["product_id"] ?? ""}`;
    if (!knownItemIds.has(itemId)) {
      continue;
    }
    const grade = row["label"] === "Exact" ? 3 : 1;
    judgments.push({ queryText: requireQueryText(queryTexts, queryId), itemId, grade });
  }
  judgments.sort(
    (left, right) =>
      left.queryText.localeCompare(right.queryText) || left.itemId.localeCompare(right.itemId),
  );
  return judgments;
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function writeLine(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const maxQueries = readFlag("max-queries", DEFAULT_MAX_QUERIES);

process.stdout.write("Reading WANDS release...\n");
const productRows = readTable(resolve(WANDS_DIR, "product.csv"));
const queryRows = readTable(resolve(WANDS_DIR, "query.csv"));
const labelRows = readTable(resolve(WANDS_DIR, "label.csv"));

const corpus = productRows.map(toCorpusItem).filter((item) => item.title !== "");
const knownItemIds = new Set(corpus.map((item) => item.id));
const queryTexts = queryTextsById(queryRows);
const counts = labelCounts(labelRows);
const selectedIds = selectQueryIds(counts, maxQueries);
const judgments = buildJudgments(selectedIds, queryTexts, labelRows, knownItemIds);

const corpusBody = `${corpus.map((item) => JSON.stringify(item)).join("\n")}\n`;
writeLine(CORPUS_PATH, corpusBody);
writeLine(JUDGMENTS_PATH, `${judgments.map((row) => JSON.stringify(row)).join("\n")}\n`);

const corpusHash = createHash("sha256").update(corpusBody).digest("hex");
const categoryCounts = countBy(corpus, (item) => item.categoryId);
writeLine(
  CORPUS_MANIFEST_PATH,
  `${JSON.stringify(
    {
      source: "WANDS (Wayfair ANnotation Dataset)",
      url: "https://github.com/wayfair/WANDS",
      license: "MIT",
      productCount: corpus.length,
      categoryCount: categoryCounts.size,
      topCategories: [...categoryCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 12)
        .map(([categoryId, count]) => ({ categoryId, count })),
      syntheticOverlay: {
        priceCents:
          "WANDS has no price. Deterministic per-product value inside a per-category band; used by the price-fit chapter.",
        postedAt:
          "WANDS has no date. Deterministic per-product value in the 180 days before the fixed EVAL_NOW; used by the recency chapter.",
        location: "Constant 'Berlin'. WANDS has no location.",
      },
      corpusHash,
    },
    null,
    2,
  )}\n`,
);

const gradeCounts = countBy(judgments, (row) => String(row.grade));
writeLine(
  JUDGMENTS_MANIFEST_PATH,
  `${JSON.stringify(
    {
      source: "WANDS human relevance labels (Exact/Partial/Irrelevant)",
      labelMapping: { Exact: 3, Partial: 1, Irrelevant: 0 },
      queryCount: selectedIds.length,
      judgmentCount: judgments.length,
      gradeCounts: Object.fromEntries(gradeCounts),
      selection: `Queries with >=${MIN_EXACT} Exact and >=${MIN_IRRELEVANT} Irrelevant, plus ${ALWAYS_INCLUDED.length} always-included teaching queries, capped at ${maxQueries}.`,
      corpusHash,
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `Wrote ${corpus.length} products, ${selectedIds.length} evaluated queries and ` +
    `${judgments.length} judgments.\n`,
);
