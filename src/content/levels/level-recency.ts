export const levelRecencyContent = {
  mechanism:
    "Tokenise the query and require every word, exactly as typed, to appear in the listing. No stemming, no synonyms, no variant collapsing. Order the strict matches newest first.",
  tradeOff:
    "Strict matching is predictable but brittle: a different word for the same thing finds nothing, and a plural finds no singular. Newest-first can bury the best match under a fresh but weaker one. WANDS has no date, so the posted date is a deterministic synthetic overlay.",
  fixesFailureMode:
    "Without a first ranker the book has nothing to run, so evaluation has no ranking to grade.",
};
