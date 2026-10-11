export interface VariantRule {
  readonly pattern: string;
  readonly canonical: string;
}

export interface LeverConfiguration {
  readonly stopWords: readonly string[];
  readonly synonymGroups: readonly (readonly string[])[];
  readonly variantRules: readonly VariantRule[];
}

interface PriceConstraint {
  readonly minCents?: number;
  readonly maxCents?: number;
}

export interface SpellingCorrection {
  readonly from: string;
  readonly to: string;
}

export interface LeverOverrides {
  readonly stemming?: boolean | undefined;
  readonly synonyms?: boolean | undefined;
  readonly variants?: boolean | undefined;
}

export interface QueryUnderstanding {
  readonly rawText: string;
  readonly tokens: readonly string[];
  readonly normalizedTokens: readonly string[];
  readonly expandedTokens: readonly string[];
  readonly predictedCategoryId: string | null;
  readonly priceConstraint: PriceConstraint | null;
  readonly spellingCorrection: readonly SpellingCorrection[];
  readonly queryVector: Float32Array | null;
  /** Lever switches the query was understood with; lets later levels rebuild tokens exactly. */
  readonly leverOverrides?: LeverOverrides | undefined;
}
