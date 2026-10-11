export const levelNormalizationContent = {
  mechanism:
    "Tokenise the query, apply the recall levers (stemming, synonyms, hyphen and spacing variants), and require one hit per word group. Order the wider matches newest first.",
  tradeOff:
    "Each recall lever retrieves more listings and also retrieves false positives. Stemming, synonyms, and variant collapsing all trade precision for recall.",
  fixesFailureMode:
    "Strict matching misses synonyms and spelling variants: the buyer and the seller do not use the same word.",
};
