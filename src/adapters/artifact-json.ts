import { existsSync, readFileSync } from "node:fs";
import type { SimulatedSession } from "../domain/simulation/session-sampler.ts";
import type { Judgment } from "../domain/types/evaluation.ts";
import type { TrainedRankingModel } from "../domain/types/level.ts";
import type { LeverConfiguration, VariantRule } from "../domain/types/query.ts";

export function readLevers(): LeverConfiguration {
  const stopWords = parseJsonFile("data/levers/stopwords.json");
  const synonymGroups = parseJsonFile("data/levers/synonyms.json");
  const variantRules = parseJsonFile("data/levers/variants.json");
  if (
    !(isStringArray(stopWords) && isStringGroups(synonymGroups) && isVariantRules(variantRules))
  ) {
    throw new Error("Malformed lever files in data/levers.");
  }
  return { stopWords, synonymGroups, variantRules };
}

export function readJudgments(path: string): Judgment[] {
  return readNdjson(path, isJudgment);
}

const LOGGED_RANKING_PATH = "data/logged-ranking.ndjson";

export function readSessions(path: string): SimulatedSession[] {
  const rankingByQuery = readLoggedRanking(LOGGED_RANKING_PATH);
  const rows = readNdjson(path, isClickRow);
  return rows.map((row) => ({
    sessionId: row.sessionId,
    queryText: row.queryText,
    clickedItemIds: row.clickedItemIds,
    shownItemIds: row.shownItemIds ?? rankingByQuery.get(row.queryText) ?? [],
  }));
}

interface ClickRow {
  readonly sessionId: string;
  readonly queryText: string;
  readonly clickedItemIds: readonly string[];
  readonly shownItemIds?: readonly string[];
}

function readLoggedRanking(path: string): ReadonlyMap<string, readonly string[]> {
  const ranking = new Map<string, readonly string[]>();
  if (!existsSync(path)) {
    return ranking;
  }
  for (const row of readNdjson(path, isLoggedRanking)) {
    ranking.set(row.queryText, row.shownItemIds);
  }
  return ranking;
}

function isLoggedRanking(
  value: unknown,
): value is { queryText: string; shownItemIds: readonly string[] } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record["queryText"] === "string" && isStringArray(record["shownItemIds"]);
}

export function readModel(path: string): TrainedRankingModel | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed = parseJsonFile(path);
  if (!isTrainedRankingModel(parsed)) {
    throw new Error(`Malformed ranking model: ${path}`);
  }
  return parsed;
}

function readNdjson<T>(path: string, isValid: (value: unknown) => value is T): T[] {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => parseNdjsonLine(line, path, isValid));
}

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseNdjsonLine<T>(
  line: string,
  path: string,
  isValid: (value: unknown) => value is T,
): T {
  const parsed: unknown = JSON.parse(line);
  if (!isValid(parsed)) {
    throw new Error(`Malformed NDJSON in ${path}`);
  }
  return parsed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isStringGroups(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every(isStringArray);
}

function isVariantRules(value: unknown): value is VariantRule[] {
  return Array.isArray(value) && value.every(isVariantRule);
}

function isVariantRule(value: unknown): value is VariantRule {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record["pattern"] === "string" && typeof record["canonical"] === "string";
}

function isJudgment(value: unknown): value is Judgment {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const grade = record["grade"];
  return (
    typeof record["queryText"] === "string" &&
    typeof record["itemId"] === "string" &&
    (grade === 0 || grade === 1 || grade === 2 || grade === 3)
  );
}

function isClickRow(value: unknown): value is ClickRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record["sessionId"] !== "string" ||
    typeof record["queryText"] !== "string" ||
    !isStringArray(record["clickedItemIds"])
  ) {
    return false;
  }
  if (record["shownItemIds"] !== undefined && !isStringArray(record["shownItemIds"])) {
    return false;
  }
  return true;
}

function isTrainedRankingModel(value: unknown): value is TrainedRankingModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const variant = record["variant"];
  const bias = record["bias"];
  const weights = record["weights"];
  return (
    (variant === "naive" || variant === "corrected") &&
    isStringArray(record["featureNames"]) &&
    Array.isArray(weights) &&
    weights.every((weight) => typeof weight === "number") &&
    typeof bias === "number"
  );
}
