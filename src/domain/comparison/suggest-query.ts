interface PairSuggestion {
  readonly ids: readonly string[];
  readonly query: string;
}

/** First match wins, so single-level rules come before pair rules. */
const SUGGESTIONS: readonly PairSuggestion[] = [
  { ids: ["level-6-two-tower"], query: "3 1/2 inch drawer pull" },
  { ids: ["level-5-cross-encoder"], query: "lamp shade" },
  { ids: ["level-1-spelling", "level-1-entities"], query: "moen faucet" },
  { ids: ["level-1-lexical", "level-1-spelling"], query: "ligth bulb" },
  { ids: ["level-1-entities", "level-2-boosting"], query: "couch" },
  { ids: ["level-1-recency", "level-1-normalization"], query: "carpet" },
  { ids: ["level-1-recency", "level-1-lexical"], query: "sofa" },
  { ids: ["level-1-normalization", "level-1-lexical"], query: "sofa" },
  { ids: ["level-1-lexical", "level-2-boosting"], query: "couch" },
  { ids: ["level-0-evaluation", "level-1-recency"], query: "couch" },
  { ids: ["level-0-evaluation", "level-1-lexical"], query: "couch" },
];

export function suggestDistinguishingQuery(leftLevelId: string, rightLevelId: string): string {
  const pair = [leftLevelId, rightLevelId].sort().join(":");
  return (
    SUGGESTIONS.find((entry) => entry.ids.every((id) => pair.includes(id)))?.query ?? "area rug"
  );
}
