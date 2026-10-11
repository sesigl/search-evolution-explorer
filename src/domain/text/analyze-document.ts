import type { LeverConfiguration } from "../types/query.ts";
import { normalizeVariants } from "./normalize-variants.ts";
import { stem } from "./stem.ts";
import { tokenize } from "./tokenize.ts";

export function analyzeDocument(text: string, levers: LeverConfiguration): string[] {
  const tokens = tokenize(text).filter((token) => !levers.stopWords.includes(token));
  const variants = normalizeVariants(tokens, levers.variantRules);
  const terms: string[] = [];
  for (const variant of variants) {
    terms.push(variant);
    const stemmed = stem(variant);
    if (stemmed !== variant) {
      terms.push(stemmed);
    }
  }
  return terms;
}
