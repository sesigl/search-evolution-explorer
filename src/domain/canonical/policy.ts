export type PolicyDecision = "FILTER" | "BOOST" | "FEATURE";

export interface PolicyInput {
  readonly confidence: number;
  readonly adPrecision: number;
  readonly coverage: number;
}

/**
 * Search policy, separate from understanding. A confident query annotation
 * does not automatically filter; filtering also needs trustworthy ads.
 */
export function decidePolicy(input: PolicyInput): PolicyDecision {
  if (input.confidence >= 0.9 && input.adPrecision >= 0.9 && input.coverage >= 0.7) {
    return "FILTER";
  }
  if (input.confidence >= 0.7) {
    return "BOOST";
  }
  return "FEATURE";
}
