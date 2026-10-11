export const level2Content = {
  mechanism:
    "Keep the lexical candidate set, then add query-dependent boosts (category match, price fit) and query-independent static quality (recency, title length, price percentile in the category). WANDS has no price, so the price is a deterministic synthetic overlay.",
  tradeOff:
    "Hand-tuned weights fight each other. A recency boost can bury a better match, and the next boost tries to undo it.",
  fixesFailureMode:
    "Lexical ranking ignores attributes the searcher named, so a black dresser and a grey dresser look the same.",
};
