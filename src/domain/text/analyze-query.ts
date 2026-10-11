import type { LeverConfiguration, LeverOverrides, QueryUnderstanding } from "../types/query.ts";
import { unique } from "../unique.ts";
import { expandSynonyms } from "./expand-synonyms.ts";
import { normalizeVariants } from "./normalize-variants.ts";
import { stem } from "./stem.ts";
import { tokenize } from "./tokenize.ts";

export function understandQuery(
  rawText: string,
  levers: LeverConfiguration,
  overrides: LeverOverrides,
): QueryUnderstanding {
  const tokens = tokenize(rawText).filter((token) => !levers.stopWords.includes(token));
  const afterVariants = leverOn(overrides.variants)
    ? normalizeVariants(tokens, levers.variantRules)
    : tokens;
  const normalizedTokens = leverOn(overrides.stemming) ? afterVariants.map(stem) : afterVariants;
  const synonymGroups = leverOn(overrides.stemming)
    ? stemGroups(levers.synonymGroups)
    : levers.synonymGroups;
  const expandedTokens = leverOn(overrides.synonyms)
    ? expandSynonyms(normalizedTokens, synonymGroups)
    : [...normalizedTokens];
  return {
    rawText,
    tokens,
    normalizedTokens,
    expandedTokens,
    predictedCategoryId: null,
    priceConstraint: null,
    spellingCorrection: [],
    queryVector: null,
  };
}

export function termGroupsFor(
  understanding: QueryUnderstanding,
  synonymGroups: readonly (readonly string[])[],
): string[][] {
  const stemmedGroups = stemGroups(synonymGroups);
  return understanding.normalizedTokens.map((token) => {
    const expanded = unique([
      token,
      ...expandSynonyms([token], synonymGroups),
      ...expandSynonyms([token], stemmedGroups),
    ]);
    return expanded.filter(
      (candidate) => candidate === token || understanding.expandedTokens.includes(candidate),
    );
  });
}

function leverOn(value: boolean | undefined): boolean {
  return value !== false;
}

function stemGroups(groups: readonly (readonly string[])[]): readonly (readonly string[])[] {
  return groups.map((group) => group.map(stem));
}
