export const level5Content = {
  mechanism:
    "A pretrained MiniLM cross-encoder reads the query and one listing together. Attention compares tokens across both texts before the model outputs a relevance score. Chapter 9 retrieves the first 50 candidates; this chapter sorts them by that joint score. The model runs locally and was trained on MS MARCO search pairs, independently of this app's judgments and clicks.",
  tradeOff:
    "Joint inference adds time for every pair, so only the first 50 candidates are reranked. Recall@50 cannot increase because those candidates stay the same. The model can improve their order, but a missing listing stays missing. A model trained on web search can also misunderstand marketplace intent; the scorecard shows those regressions. Fine-tuning on this app's own judgments is the next optimization step, not a requirement: the pretrained model already lifts NDCG@10 and MRR above chapter 9. Fine-tune only when that gain justifies a training pipeline and a fixed data snapshot.",
  fixesFailureMode:
    "Independent encoding compresses each text before the two meet. Joint attention can check details across the query and listing, rather than relying only on vector similarity and the fused rank.",
};
