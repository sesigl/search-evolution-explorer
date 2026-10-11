# Chapter 6: trained retrieval

## Goal

Turn the preview into a runnable chapter. Keep Chapter 5's 50 candidates and joint scores. Add at most 50 available listings from a trained two-tower retriever. Score only new candidates with the same cross-encoder. Sort the union before pagination.

## Data and model

- Use the existing inventory and frozen MiniLM text embeddings. The failed click-pair attempt is documented in `chapter-6-retrieval-research.md`.
- Train separate linear query and item projection heads on training-query graded preferences. The transformer stays frozen. Initialize from inventory SVD and regularize changes from that projection. Item inputs mix 80% title embedding and 20% full-text embedding because descriptions often contain off-topic text.
- Split normalized query texts deterministically before making pairs: 70% training, 10% validation, 20% test buckets. Related queries can still cross the split. Report that limit.
- Use validation retrieval NDCG to select the checkpoint, then validation final NDCG to select the neighbour budget and global score-fusion weight. Never use test-query labels in either step. Keep the current answer key unchanged.
- Store input hashes, training configuration, split membership, and model/index checksums. Missing, malformed, or stale artifacts must disable Chapter 6 with a rebuild command.
- Use exact vector search for the current 1,010 listings (1,009 available). Explain ANN as the larger-scale deployment step, not as an implemented algorithm.

## Observable checks

1. A listing absent from Chapter 5 can enter Chapter 6 through learned retrieval.
2. Existing joint scores are reused. Duplicate and unavailable listings do not enter the union. Final ranking combines joint scores and trained similarity at a validation-selected scale, with both terms shown.
3. Query and item heads apply the exported projection and unit normalization. Invalid dimensions or scores fail explicitly.
4. Search, comparison, grading, pagination, code links, and checkpoints use the real ranker.
5. The scorecard includes a common held-out query comparison for every ready chapter. Overall results are marked as containing training queries.

## Teaching content

Retain the four-step lesson, runnable examples, glossary, source callouts, and chapter checkpoint. Keep learning on the search page, below the ranked results: five interactive stages for retrieval experiments, a loss calculator, actual score inspection, live evaluation, and operational questions with expandable answers. Include training source and primary references in those stages. Do not add a separate reading page. Select the worked inventory example from actual measured output.

## Delivery checks

Run the repository verification gates, the live evaluation, and browser checks. A measured regression is evidence to explain, not a reason to change the answer key or invent a gain.
