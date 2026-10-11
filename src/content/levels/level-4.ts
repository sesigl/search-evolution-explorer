export const level4Content = {
  mechanism:
    "Independent encoding: the document vector is computed once at build time and stored. The query is encoded at request time and compared with cosine similarity. Those two ranked lists are fused with reciprocal rank fusion. Joint encoding cannot be precomputed and can only rerank a short list.",
  tradeOff:
    "A second index and an encoder at query time cost more than lexical search. Brute-force cosine is honest at this corpus size; production needs an ANN index once the corpus is millions of documents.",
  fixesFailureMode:
    "Lexical matching misses paraphrases and typos that share meaning but not tokens.",
};
