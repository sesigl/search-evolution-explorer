import type { SpellingCorrection, VariantRule } from "../types/query.ts";
import { normalizeVariants } from "./normalize-variants.ts";
import { stem } from "./stem.ts";
import { tokenize } from "./tokenize.ts";

const SHORT_TOKEN_LENGTH = 4;
const SHORT_TOKEN_DISTANCE = 1;
const LONG_TOKEN_DISTANCE = 2;
const MIN_WORD_LENGTH = 3;
const DIGIT = /\d/;
const ALL_DIGITS = /^\d+$/;

/** Classic edit distance: insertions, deletions and substitutions cost 1. */
export function levenshtein(left: string, right: string): number {
  let previous: number[] = [];
  for (let index = 0; index <= right.length; index += 1) {
    previous.push(index);
  }
  for (let row = 1; row <= left.length; row += 1) {
    const current: number[] = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const substitution =
        (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1);
      current.push(
        Math.min((previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1, substitution),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

/**
 * Per-token document counts with the same word filter the vocabulary uses. Tokens are
 * normalised with the same variant rules the query path uses, so a canonical form such as
 * "ebike" is a known word and never gets rewritten to a shorter neighbour.
 */
function countDocuments(
  texts: readonly string[],
  rules: readonly VariantRule[],
): ReadonlyMap<string, number> {
  const documents = new Map<string, number>();
  for (const text of texts) {
    const seen = new Set<string>();
    for (const token of normalizeVariants(tokenize(text), rules)) {
      if ((token.length >= MIN_WORD_LENGTH || DIGIT.test(token)) && !seen.has(token)) {
        seen.add(token);
        documents.set(token, (documents.get(token) ?? 0) + 1);
      }
    }
  }
  return documents;
}

/**
 * The words a correction may suggest: raw listing words of length 3 or more, plus any token
 * with a digit (model numbers such as 13 or 256gb). Stems are excluded on purpose, so a
 * correction always points at a word a seller actually wrote. Tokens are compared in the
 * same normalised form the query uses, so canonical variants are never "unknown". Only words
 * seen in at least `minDocuments` listings qualify: a one-off may itself be a typo, and must
 * not rewrite queries.
 */
export function buildVocabulary(
  texts: readonly string[],
  minDocuments = 1,
  rules: readonly VariantRule[] = [],
): ReadonlySet<string> {
  const words = new Set<string>();
  for (const [token, count] of countDocuments(texts, rules)) {
    if (count >= minDocuments) {
      words.add(token);
    }
  }
  return words;
}

/**
 * The closest vocabulary word within edit distance 1 (short tokens) or 2 (longer ones).
 * Returns null for known words, for words whose stem is known (plurals need no correction),
 * and when two words tie: a guess must be unique to be applied. A word without a digit is
 * never corrected into a model number. The one exception is an inflectional tie ("sofah"
 * next to "sofa" and "sofas"): every candidate shares one stem, so the base form wins.
 */
export function bestCorrection(token: string, vocabulary: ReadonlySet<string>): string | null {
  if (vocabulary.has(token) || vocabulary.has(stem(token))) {
    return null;
  }
  const limit = token.length <= SHORT_TOKEN_LENGTH ? SHORT_TOKEN_DISTANCE : LONG_TOKEN_DISTANCE;
  const candidates = [...vocabulary].filter((word) => isCandidate(token, word, limit));
  let closest: string[] = [];
  let bestDistance = limit + 1;
  for (const word of candidates) {
    const distance = levenshtein(token, word);
    if (distance <= limit && distance < bestDistance) {
      closest = [word];
      bestDistance = distance;
    } else if (distance <= limit && distance === bestDistance) {
      closest.push(word);
    }
  }
  if (closest.length === 1) {
    return closest[0] ?? null;
  }
  return baseForm(closest);
}

function isCandidate(token: string, word: string, limit: number): boolean {
  if (Math.abs(word.length - token.length) > limit) {
    return false;
  }
  return DIGIT.test(token) || !DIGIT.test(word);
}

/** When every tied candidate is one word in different forms, the base form wins. */
function baseForm(closest: readonly string[]): string | null {
  if (closest.length === 0) {
    return null;
  }
  const stems = new Set(closest.map((word) => stem(word)));
  if (stems.size !== 1) {
    return null;
  }
  return closest.find((word) => word === stem(word)) ?? null;
}

/**
 * A missing word written as one token ("iphonecase"): every split where both parts are
 * vocabulary words. Digit parts may be short ("iphone13" into "iphone" and "13").
 */
export function splitCompound(
  token: string,
  vocabulary: ReadonlySet<string>,
): readonly [string, string] | null {
  if (vocabulary.has(token)) {
    return null;
  }
  for (let index = 1; index < token.length; index += 1) {
    const left = token.slice(0, index);
    const right = token.slice(index);
    if (isWordPart(left) && isWordPart(right) && vocabulary.has(left) && vocabulary.has(right)) {
      return [left, right];
    }
  }
  return null;
}

function isWordPart(part: string): boolean {
  if (ALL_DIGITS.test(part)) {
    return true;
  }
  return part.length >= MIN_WORD_LENGTH;
}

/** Replace each unknown token by its unique correction, or by its compound split. */
export function correctTokens(
  tokens: readonly string[],
  vocabulary: ReadonlySet<string>,
): { corrected: string[]; corrections: SpellingCorrection[] } {
  const corrected: string[] = [];
  const corrections: SpellingCorrection[] = [];
  for (const token of tokens) {
    const fix = bestCorrection(token, vocabulary);
    if (fix === null) {
      const split = splitCompound(token, vocabulary);
      if (split === null) {
        corrected.push(token);
      } else {
        corrected.push(split[0], split[1]);
        corrections.push({ from: token, to: `${split[0]} ${split[1]}` });
      }
    } else {
      corrected.push(fix);
      corrections.push({ from: token, to: fix });
    }
  }
  return { corrected, corrections };
}
