import { understandQuery } from "../text/analyze-query.ts";
import { tokenize } from "../text/tokenize.ts";
import type { Category } from "../types/corpus.ts";
import type { LeverConfiguration, LeverOverrides, QueryUnderstanding } from "../types/query.ts";
import { categoryFromTokens } from "./category-from-tokens.ts";

const SPELLING_CORRECTIONS: ReadonlyMap<string, string> = new Map([
  ["ligth", "light"],
  ["biycicle", "bicycle"],
  ["pedistole", "pedestal"],
  ["foutains", "fountains"],
  ["lsmp", "lamp"],
  ["desins", "designs"],
  ["blk", "black"],
  ["draw", "drawer"],
  ["tjat", "that"],
  ["roomtables", "room tables"],
]);

const UNDER_PRICE = /under\s+(\d+)/i;
const CENTS_PER_EURO = 100;

export function queryTextForEncoding(rawText: string): string {
  const tokens = tokenize(rawText);
  return tokens.map((token) => SPELLING_CORRECTIONS.get(token) ?? token).join(" ");
}

export function understand(
  rawText: string,
  levers: LeverConfiguration,
  overrides: LeverOverrides,
  _categories: readonly Category[],
): QueryUnderstanding {
  const base = understandQuery(rawText, levers, overrides);
  const tokens = tokenize(rawText);
  return {
    ...base,
    predictedCategoryId: categoryFromTokens(tokenize(queryTextForEncoding(rawText))),
    priceConstraint: extractPrice(rawText),
    spellingCorrection: correctSpelling(tokens),
    leverOverrides: overrides,
  };
}

function extractPrice(rawText: string): QueryUnderstanding["priceConstraint"] {
  const match = UNDER_PRICE.exec(rawText);
  const amount = match?.[1];
  if (amount === undefined) {
    return null;
  }
  return { maxCents: Number(amount) * CENTS_PER_EURO };
}

function correctSpelling(tokens: readonly string[]): QueryUnderstanding["spellingCorrection"] {
  const corrections: { from: string; to: string }[] = [];
  for (const token of tokens) {
    const suggestion = SPELLING_CORRECTIONS.get(token);
    if (suggestion !== undefined) {
      corrections.push({ from: token, to: suggestion });
    }
  }
  return corrections;
}

/**
 * Price bounds are query understanding, not listing words. Matching must not require
 * "under" or the number to appear in the ad.
 */
export function understandingForMatching(understanding: QueryUnderstanding): QueryUnderstanding {
  const price = understanding.priceConstraint;
  if (price === undefined || price === null || price.maxCents === undefined) {
    return understanding;
  }
  const dropped = new Set(["under", "over", String(price.maxCents / CENTS_PER_EURO)]);
  return {
    ...understanding,
    tokens: understanding.tokens.filter((token) => !dropped.has(token)),
    normalizedTokens: understanding.normalizedTokens.filter((token) => !dropped.has(token)),
    expandedTokens: understanding.expandedTokens.filter((token) => !dropped.has(token)),
  };
}
