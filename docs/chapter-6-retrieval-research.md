# Chapter 6: improving retrieval from a small, biased click log

> **Superseded (WANDS migration).** This research was written against the previous
> synthetic corpus and its latent-relevance click simulator. Those modules were removed
> when the catalog and the answer key moved to WANDS (see `docs/dataset-choice.md`). The
> findings about supervision quality still apply in spirit, but the file and module
> references below describe code that no longer exists.

Research date: 2026-09-13.

## Conclusion

The next experiment should improve the training signal and preserve the frozen model's geometry before adding model capacity. The current run has much less independent supervision than its pair count suggests. Its validation loss covers only nine queries. Its click target also differs from the judged relevance target.

Recommended order:

1. Replace sampled click-versus-skip labels with a likelihood that uses all logged exposures and the known examination probability.
2. Compare the present heads with constrained, geometry-preserving heads. Measure concentration and retrieval changes on training and validation queries.
3. Select the candidate policy at a fixed cross-encoder budget. Compare against a wider Chapter 5 baseline and an untrained projection control.
4. Test cross-encoder distillation and filtered hard negatives only after these controls. Both can help, but neither guarantees improvement against the answer key.

These are proposed experiments, not measured improvements. This research made no model, training-data, judgment, or serving-code changes.

## 1. What the current implementation does

The following facts come from the repository, rather than from the cited papers.

| Component | Observed implementation |
| --- | --- |
| Base representation | `data/embeddings.manifest.json`: `Xenova/all-MiniLM-L6-v2`, 384 dimensions; 1,010 indexed items. |
| Split | `scripts/prepare-two-tower.ts:8-24`: hash normalized query text into train/validation/test before sampling. Actual split sizes are 133/26/32 normalized queries. |
| Sampling | `scripts/train-two-tower.py:24-47`: shuffle sessions once, choose one clicked and one skipped item from a usable session, and cap at 128 pairs per query. Reuse these pairs for every epoch. |
| Weight | Positive's logged rank, capped at 20. No separate correction for positive selection, negative selection, or logging-policy inclusion. |
| Model | Two bias-free 384-to-96 linear heads, initially identical but trained independently; normalized outputs. There are 73,728 trainable head parameters. |
| Objective | Weighted pairwise softplus at temperature 0.1, normalized by the weight sum in each minibatch. |
| Selection | Lowest validation loss on the same fixed sampled-pair set. Epoch 2 wins: 0.70277, versus 0.87165 at initialization and 1.17304 at epoch 30. |
| Serving | `src/domain/levels/level-6-two-tower.ts:52-83`: retrieve learned top 50, union with Chapter 5's shortlist, and score new items with the same cross-encoder. Learned similarity is a displayed signal, not the final score. |
| Budget | Chapter 5 scores at most 50 pairs. Chapter 6 scores up to 100 distinct pairs, depending on overlap and availability. |

The reported evaluation is:

| Query set | Chapter 5 NDCG@10 | Chapter 6 NDCG@10 | Change |
| --- | ---: | ---: | ---: |
| Overall, 193 judged queries | 0.6340 | 0.6317 | -0.0023 |
| Existing test split, 32 queries | 0.6772 | 0.6856 | +0.0084 |

Overall Recall@50 rises from 0.4507 to 0.4736, with 21 NDCG regressions. These metrics were supplied with the research request; this research did not rerun the evaluator.

**Recall@50 here is recall in the final cross-encoder-ranked top 50.** It is not recall over the entire candidate union. `src/domain/evaluation/scorecard.ts:13-15,116-132` makes this distinction important. The evaluator counts every grade above zero as relevant for recall, while NDCG distinguishes grades. More marginally relevant results can therefore raise recall without improving top-10 ordering.

### Read-only audit of the actual training input

These counts were computed from `.cache/two-tower/training.json`, with the sampler's seed, order, and choices reproduced in memory. Pair counts match the exported model manifest. No relevance labels were read for this audit.

| Quantity | Train | Validation |
| --- | ---: | ---: |
| Normalized query groups | 133 | 26 |
| Sessions | 34,874 | 6,926 |
| Queries with no logged candidates | 58 | 13 |
| Queries that actually produce pairs | **58** | **9** |
| Queries reaching the 128-pair cap | 57 | 9 |
| Sampled pairs | 7,421 | 1,152 |
| Distinct `(query, positive, negative)` triples | **3,664** | **628** |
| Click events before pair sampling | 47,327 | 7,848 |
| Distinct logged `(query, item)` combinations | 2,317 | 286 |
| Distinct clicked `(query, item)` combinations | 2,208 | 280 |
| Distinct sampled positive `(query, item)` combinations | 1,182 | 181 |
| Sampled negatives clicked in another session for the same query | **7,320** | **1,142** |
| Selected positives at logged rank >20 | 716 | 112 |
| Median positive / negative logged rank | 2 / 7 | 2 / 8 |
| Largest logged candidate list | 169 | 90 |
| Weight-only effective sample size | about 2,830 | about 463 |

The last row is `(sum w)^2 / sum(w^2)`. It describes weight concentration only. It does not account for repeated triples or dependence within a query, so it is not a count of independent observations.

Important consequences:

- The model is selected on nine query groups, not 1,152 independent search tasks.
- A further 17 training groups and four validation groups have logged candidates but no usable sampled comparison. Pairwise training cannot use singleton lists.
- Almost all logged items eventually receive a click. “Exclude every item ever clicked for this query” would remove about 98.6% of existing training pairs. A historical click is not a reliable binary relevance label here.
- At most 58 training query vectors provide task gradients to the query head. Repeating their pairs does not add new query directions. The 133-query split size overstates the breadth of supervised query training.

## 2. Sampling bias: several distinct problems

### 2.1 Examination correction is only one correction

The simulator independently samples each item's click with

`P(click | query, item, rank r) = sigmoid(latentRelevance(query, item)) / r`.

Source: `src/domain/simulation/session-sampler.ts:44-51`.

Joachims, Swaminathan, and Schnabel derive IPS under a position-based model and require positive observation propensity for relevant results. Their method uses each click as an observation and evaluates a ranking objective over a defined candidate set. It does not justify treating an arbitrary sampled unclicked result as a known irrelevant document. They also show why clipping can help small datasets by trading bias for variance. [S1, Sections 4–7.2]

The current sampler changes the observation distribution after clicks occur:

1. A click in a session with `c` clicks has selection probability `1/c`.
2. A skipped item in a session with `u` skips has selection probability `1/u`.
3. Sessions without a click or without a skip cannot contribute.
4. Each query contributes at most 128 pairs, irrespective of its full exposure record.
5. Clipping at 20 leaves a positive at rank `r > 20` underweighted relative to full examination IPS by a factor `20/r`.

Thus, weighting a retained pair by `min(r, 20)` does not reconstruct an all-click or all-exposure objective. Per-minibatch self-normalization adds a finite-sample ratio effect. This is a weighted sampled-pair surrogate, with useful possible bias/variance trade-offs, rather than a demonstrated unbiased estimator of the desired retrieval metric.

Multiplying by `c*u` alone is not a complete fix: it would target a particular full pair sum, whose relation to relevance still needs justification, and can cause large variance. First specify the desired objective. Then derive any sampling correction for that objective.

### 2.2 Logging-policy support cannot be recovered by IPS

`scripts/simulate-clicks.ts:77-105` logs deterministic Chapter 2 matches. A semantically useful item outside that set has zero inclusion probability for the query. More sessions at the same fixed ranking do not change this. The no-candidate groups above are the clearest example.

No choice of IPS cap can identify relevance outside this support. Generalization there must come from the frozen representation, shared features, a teacher, additional feedback, or a different logging policy. This follows directly from the positivity condition in [S1]. Offline click-based validation of those additions has the same limitation.

Also, restricting negatives to positions above a click does not establish examination in this simulator. It samples clicks independently across ranks; it does not implement a sequential browsing model. Only rank 1 has examination probability 1, and even its non-click is a stochastic outcome rather than proof of irrelevance.

### 2.3 In-batch `log Q` correction is a different method

Yi et al. show that in-batch softmax over-samples popular items as negative competitors. Their correction subtracts `log(p_item)` from sampled logits, using the item's sampling probability. It addresses the sampled softmax denominator. It does not correct examination or turn a skipped result into a relevance negative. [S2, Section 3, equations 1–4]

There is no in-batch softmax in the current trainer, so adding `log Q` to its pairwise loss is not a direct application of that paper. If a sampled-softmax experiment is added, probabilities must describe the actual sampler, including its query balancing and duplicate handling. At 1,010 items, an exact denominator is cheap enough to be a useful control. An exact denominator removes this sampling approximation; it does not solve missing feedback or false negatives.

## 3. The click target differs from the judgment target

This is a confirmed target mismatch in the source, not just a general concern about user clicks.

- Clicks use `sigmoid(latentRelevance(...))`.
- Judgments use `min(quantizeGrade(latentRelevance(...)), humanExactnessCap(...))`.

See `src/domain/simulation/latent-relevance.ts:72-95` and `src/domain/simulation/human-exactness-cap.ts:9-46`.

The cap encodes additional distinctions, including unwanted product types, accessories, implausible iPhone titles, and some wrong product variants. Those cap decisions are not applied by the click sampler. Also, a latent score near zero has click attractiveness near 0.5 after examination, despite being below the first positive-grade threshold of 0.4. A click is therefore quite weak evidence of positive judged relevance in this simulator.

Consequences:

- Even a statistically correct click learner can disagree with judged NDCG.
- Lower validation click loss cannot guarantee a better overall scorecard.
- Copying the cap rules into training would use answer-key logic. It would not be a valid click-learning improvement.
- Existing frozen-model or cross-encoder knowledge can supply additional information without reading judgments, but its errors must still be measured.

This is consistent with Yi et al.'s distinction between optimizing raw clicks and using a reward that reflects the actual engagement objective. Their production experiments did not treat click probability as a sufficient final objective. [S2, Sections 5.1 and 6.3]

## 4. Proposed objective: all-exposure click likelihood

This is the strongest first experiment because the simulator's examination law is known and the same queries repeat hundreds of times.

For training queries only, aggregate:

- `n[q,d,r]`: times item `d` was listed at rank `r` for normalized query `q`;
- `k[q,d,r]`: corresponding click count.

Retain rank in the aggregation key. Different raw queries that normalize to the same query can have different logged lists. Include zero-click sessions and singleton lists. Do not create exposures for unlisted items.

Let `s(q,d)` be the normalized two-tower dot product, and define:

`a(q,d) = sigmoid(scale * s(q,d) + offset)`

`p(q,d,r) = a(q,d) / r`

`loss(q,d,r) = -k * log(p) - (n-k) * log(1-p)`.

Fit a positive scale and an offset on training data with the heads. The expression is the binomial negative log-likelihood, up to a parameter-independent constant. It follows from the repository's click generator and the position-based examination model in [S1, Section 5.1]. Click likelihood with a separate bias factor is also described in [S9, Section 3].

Why this is preferable to a hard skip label:

- A non-click at rank 100 is consistent with either low or high attractiveness. The likelihood represents this directly.
- All observed click and non-click counts contribute, without randomly discarding extra clicks.
- Repeated observations reduce uncertainty rather than creating contradictory hard pair labels.
- Examination is built into the probability, so no additional rank-IPS multiplier is needed for this likelihood.

Use per-query normalization and macro averaging as an explicit objective choice. Compare this with exposure-weighted averaging on validation. This changes the target weighting; it should be recorded rather than described as universally unbiased. Model misspecification and missing support still apply.

PyTorch already provides `Binomial(total_count=..., probs=...).log_prob(click_count)`. The probability must be `a/r`, not a raw similarity logit. A tensor implementation of the expression above can omit the constant. [S10]

### Lower-change comparison

If retaining pairwise training, use aggregate exposure evidence to define a *soft* preference and its confidence. For example, fit a regularized attractiveness estimate on training clicks, compare estimates only where their uncertainty is sufficiently separated, and downweight ambiguous pairs. Validate this separately from the direct likelihood. A naive estimate `r * CTR` can exceed one and is unstable for deep ranks, so it needs constrained estimation and uncertainty handling.

An alternative close to [S1] is an all-click propensity-weighted ranking surrogate with its candidate set explicitly defined. Preserve every click or sample clicks with a known inclusion probability. This avoids pretending that one skipped result supplies an explicit negative judgment.

## 5. Hard negatives and teacher supervision

Random negatives and hard negatives optimize different parts of ranking. Zhan et al. show that hard negatives focus training on top-ranked errors, while static hard-negative sets can become unstable. Their STAR method mixes random and hard negatives, and ADORE updates query-side training against current retrieval results. [S3, Sections 4–6]

However, harder negatives alone are a poor next step here. The current skips are already uncertain. RocketQA found that unfiltered hard negatives could reduce retrieval performance and used a cross-encoder to remove likely false negatives. Its reported false-negative rate is specific to its QA data and must not be transferred to this dataset. [S4, Sections 3.3 and 4.2.2]

### Feasible local experiment

1. For each **training query**, collect a fixed-size pool from lexical ranking, frozen dense ranking, and the current learned ranking.
2. Score the pool once with the existing frozen cross-encoder. Store these as teacher scores, clearly separate from clicks and judgments.
3. Prefer soft pair targets or teacher margins. Exclude ambiguous teacher pairs from hard-negative training. Do not reuse RocketQA's numerical probability thresholds: this repository's cross-encoder scores are not established calibrated probabilities.
4. Mix teacher-filtered hard competitors with easy/random competitors. Refresh the learned portion once per epoch. The entire corpus is small enough for exact scoring.
5. Keep query groups unique within a contrastive batch where practical. Mask duplicate items and avoid treating another positive for the same query as a hard negative.

Hofstätter et al.'s Margin-MSE trains the student on the difference between two teacher scores, rather than forcing absolute scores to match. The teacher can reverse a nominal positive/negative pair. This is well suited to noisy click pairs. [S5, Section 3]

For example, use a controlled mixture of the click likelihood and:

`(student_margin - teacher_margin)^2`.

Because cosine differences are bounded and teacher margins may not be, introduce a training-fitted student scale or an explicitly documented target scaling. Select the mixture on validation only. Pool selection, margin scaling, and teacher weights are learned choices and must not use test queries.

Teacher limits matter: distilling the same cross-encoder can make retrieval agree with the later reranker, but it can also retrieve more of that reranker's false positives. Teacher agreement is a proxy, not proof of judged improvement. This experiment adds teacher supervision and must be described that way.

## 6. Representation concentration and generalization

The exported checkpoint was inspected in memory. For comparison, the initialization was reconstructed with seed 42 and the current local `Linear(384,96,bias=False)` initializer. No training was run. Query statistics below use only the 159 training and validation query vectors.

The effective rank here is `exp(-sum(p * log(p)))`, where `p` is the normalized eigenvalue spectrum of the centered embedding covariance. The mean-vector norm measures concentration of unit vectors in a common direction.

| Representation | Covariance effective rank | Largest variance share | Mean-vector norm |
| --- | ---: | ---: | ---: |
| Frozen item vectors, 384d | 116.30 | 0.075 | 0.508 |
| Reconstructed initial item projection, 96d | 54.57 | 0.085 | 0.510 |
| Selected trained item vectors, 96d | **39.34** | **0.184** | **0.853** |
| Frozen train/validation query vectors, 384d | 28.20 | 0.119 | 0.513 |
| Reconstructed initial query projection, 96d | 23.43 | 0.119 | 0.476 |
| Selected trained query vectors, 96d | **17.33** | **0.215** | **0.599** |

Both trained weight matrices remain full row rank at ordinary numerical tolerances: their smallest-to-largest singular-value ratios are about 0.313 and 0.248. The evidence therefore shows increased concentration and reduced effective dimension, **not complete collapse**. Nor does it establish that concentration caused the NDCG loss. Useful semantic structure is not necessarily isotropic.

Jing et al. show that contrastive objectives can still exhibit dimensional collapse. Their analysis and experiments concern self-supervised visual learning, with assumptions different from this single-linear-head click model. Use the paper to motivate diagnostics, not to claim that its collapse theorem applies here. [S6, Sections 3–5]

### Small-model experiments, in order

1. **Separate compression from training.** Evaluate frozen 384d retrieval, a fixed shared random 96d projection, and a fixed shared 96d projection fitted without labels to the inventory. An uncentered SVD projection fits the present bias-free export format; centered PCA would require exporting and applying the mean. Inventory-only fitting is transductive use of known documents and should be recorded.
2. **Anchor independent heads to a useful starting map.** Write each head as `P + Delta`, initialize both deltas at zero, and penalize the mean squared delta. This preserves separate towers while limiting unsupported changes. Ordinary AdamW penalizes weight magnitude; it does not explicitly preserve the starting semantic map.
3. **Reduce adaptation capacity.** Compare rank-8/rank-16 factored deltas with a full delta. With factors shaped 96-by-r and r-by-384, rank 8 uses 7,680 trainable factor parameters across both heads, versus 73,728 full-head parameters. Initialize one factor randomly and the other at zero; two zero factors would receive no initial gradient. Fold the result into a 96-by-384 matrix for serving.
4. **Preserve base similarities.** On training queries and sampled inventory items, penalize excessive change from frozen or fixed-projection similarities. Weight this auxiliary loss on validation. It supplies a semantic prior for cases that have little click evidence.
5. **Use a query-only adaptation as a diagnostic.** Freeze the item projection and train the query head. This tests whether moving the entire item space is necessary. ADORE provides a primary-source precedent for query-side optimization, though its task and objective differ. [S3]

An identity-plus-low-rank 384d adaptation is another useful control if changing output dimension is acceptable. It starts exactly at the original cosine geometry and still uses only small trainable deltas. A 96d map cannot preserve all 384d information exactly.

VICReg's per-dimension variance and covariance penalties are a later option if concentration tracks retrieval regressions. [S7, Section 4] Apply any adapted penalty to a deliberate distribution of distinct queries/items, rather than repeated triples. Do not copy a standard-deviation floor of 1 onto unit-normalized 96d vectors: their total variance is at most 1. The original paper uses unnormalized embeddings. With only 58 task-supervised query vectors, centered query covariance also cannot have rank above 57. Forcing 96 independent query directions from that batch is impossible.

## 7. Equal-budget candidate selection

The present union preserves Chapter 5's candidates, but not their top-10 positions. With identical reused baseline scores, a new candidate that the cross-encoder overvalues can displace a better judged result. Candidate-set inclusion can only help an oracle with correct labels; the actual reranker is not such an oracle.

### Controls required to attribute a gain

| Control | What it tests |
| --- | --- |
| Chapter 5 hybrid top 50, then cross-encoder | Current baseline. |
| Same hybrid ranking, top 100, then cross-encoder | Whether extra reranking budget alone explains improvement. |
| Hybrid shortlist plus fixed random-projection retrieval | Whether compression/random perturbation gives similar candidate diversity without click training. |
| Hybrid shortlist plus trained retrieval | Contribution of learned retrieval. |
| Learned-only top K, then the same cross-encoder | Learned retriever quality without baseline protection. |
| Mixed retrieval with exactly K unique candidates, then cross-encoder | Quality under a fixed reranking budget. |

Chapter 4 currently limits frozen vector retrieval to 50 (`src/domain/levels/level-4-hybrid.ts:11,88-92`). Increasing the hybrid shortlist to 100 does not itself increase the frozen dense retrieval depth. Record that distinction. A separately labelled control can increase that depth too.

For the current variable-size union, also compare with the baseline's first `|union(q)|` candidates where available. Report candidate counts when a source cannot fill the budget. At this corpus size, a cross-encoder-over-all-items diagnostic on validation queries can expose the reranker's own ceiling and false-positive behavior; it is not a serving-budget comparison.

### Two simple fixed-budget policies

**Quota policy:** For `K=50`, compare a small preregistered grid of learned quotas, such as `m in {0,5,10,20}`. Retain the first `K-m` hybrid candidates, add up to `m` learned-only candidates, then backfill duplicates or unavailable items in a deterministic source order. Do all selection before cross-encoder scoring.

**Rank-fusion policy:** Fuse hybrid and learned ranks, retain the first K available unique candidates, and then cross-encode. Standard RRF uses `sum(1/(k+rank))`, avoiding incompatible raw score scales. [S8] A learned-source weight is a local extension, not a result established by the original RRF paper. Because the hybrid rank already includes frozen dense retrieval, check whether a second dense source simply receives too much influence.

Score-100-then-keep-50 is still a 100-pair reranking budget. Count all distinct cross-encoder pairs, including cached ones, and report cold-cache work separately from latency.

Measure candidate recall before reranking, final Recall@50, final NDCG@10, overlap, useful additions, displaced results, and p50/p95 latency. Only the final locked evaluation may use test labels for those relevance-based measures. Development uses the train/validation evidence allowed by the protocol below.

## 8. Train/validation-only experiment protocol

The repository currently forbids relevance-judgment input during training and uses validation clicks for selection. The following protocol preserves that boundary.

1. **Freeze existing test membership.** Neither training, teacher-pool construction, regularization fitting on queries, nor hyperparameter selection uses test queries or their clicks. The published 32-query result is already observed, so describe subsequent results honestly as an existing held-out audit rather than a newly untouched test.
2. **Use every validation exposure.** Replace the nine-query sampled-pair selection metric with macro click likelihood over groups with logged exposure. Report the uncovered groups explicitly. A query with no exposure supplies no click-based model-selection signal; zero loss must not be interpreted as success.
3. **Add retrieval-aware validation.** Measure IPS-weighted clicked-item coverage at K and a position-discounted clicked-item utility on the full inventory ranking. Use the known rank propensity and all clicks, with unclipped estimates plus a preregistered clipped sensitivity check. This can assess outcomes inside logging support only. It is not judged NDCG and cannot identify the relevance of never-shown additions. [S1, Sections 5 and 7.1]
4. **Check generalization within training data.** Build a few fixed folds grouped by normalized product intent and close query variants, using only the existing training set. The present exact-string hash can put related queries in different splits. Bootstrap by query or intent group, not by individual pair. Use these folds to reduce dependence on the small validation set, not to run an unlimited search.
5. **Use a small sequential ablation plan.** Start with the existing run, fixed-projection controls, and all-exposure likelihood. Then test anchored capacity. Only then test teacher supervision and the fixed-budget policy. Compare several fixed seeds for finalists; report mean and spread rather than retaining a lucky seed.
6. **Lock a configuration before the final scorecard.** Record weights, input hashes, candidate quota/fusion settings, checkpoint rule, seeds, and all tried configurations. Run the existing overall and held-out evaluation as a final audit. The user's acceptance criterion is an actual overall improvement, not a gain only on the test subset or on recall.

The overall 193-query score is a useful product acceptance measure but contains training queries. It is not an independent generalization estimate. Likewise, an overall improvement does not imply that every query improves. Report the mean change, wins/ties/losses, and worst regressions separately.

If validation judgments are later authorized for model selection, isolate them by the existing split before use and declare the protocol change. They can align selection with final NDCG more directly than clicks. Do not silently tune against all 193 judged queries or copy answer-key exactness rules into candidate selection.

### Practical first run

- Aggregate all training exposures by normalized query, item, and original rank.
- Fit the binomial click model with an anchored, low-rank adaptation of a shared projection.
- Compare against the same initialization with no adaptation and against the current sampled-pair model.
- Select using all-exposure validation and training-only grouped checks.
- Compare fixed 50-pair candidate policies before trying larger reranking budgets.

All expensive text encoding is already cached. A 256-by-1,010 float32 score matrix is about 1 MiB, and all 1,010 384d document vectors are about 1.55 MiB. These head-training and exact-retrieval experiments are feasible on a local CPU. Teacher inference is likely to dominate cost, so bound and cache training-query teacher pools.

## 9. Primary sources and verification notes

All sources below were opened and checked on the research date. Paper claims above are limited to the cited sections; proposed local adaptations are identified as experiments.

- **[S1] Joachims, Swaminathan, and Schnabel. “Unbiased Learning-to-Rank with Biased Feedback.” WSDM 2017.** [Full author manuscript](https://arxiv.org/html/1608.04468). Sections 4–5: IPS assumptions, positivity, examination, and click noise. Section 6: every click yields an observation. Sections 7.1–7.2: click-only validation and the small-data clipping trade-off. This is not a proof for the repository's sampled skip-pair loss.
- **[S2] Yi et al. “Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations.” RecSys 2019.** [Google Research publication](https://research.google/pubs/sampling-bias-corrected-neural-modeling-for-large-corpus-item-recommendations/), [full paper](https://storage.googleapis.com/gweb-research2023-media/pubtools/5716.pdf). Section 3: in-batch `log Q` correction and temperature. Sections 5.1 and 6.3: reward design and raw-click versus engagement objectives. PDF inspected in full.
- **[S3] Zhan et al. “Optimizing Dense Retrieval Model Training with Hard Negatives.” SIGIR 2021.** [Full paper](https://arxiv.org/html/2104.08051). Sections 4–6: random versus hard-negative objectives, static-negative instability, STAR, and query-side ADORE. Provides reasons to test negative mixtures and query-only adaptation, not a guaranteed improvement on biased clicks.
- **[S4] Qu et al. “RocketQA: An Optimized Training Approach to Dense Passage Retrieval for Open-Domain Question Answering.” NAACL 2021.** [Full paper](https://arxiv.org/html/2010.08191). Sections 3.3 and 4.2.2: denoised hard negatives, cross-encoder filtering, and limited-data batch-size trade-offs. Its thresholds and QA-specific statistics are not calibrated for this app.
- **[S5] Hofstätter et al. “Improving Efficient Neural Ranking Models with Cross-Architecture Knowledge Distillation.” 2020.** [Full paper](https://arxiv.org/html/2010.02666). Section 3: Margin-MSE and teacher-score caching. The work measures improved retrieval/reranking on its benchmarks; this report proposes a local adaptation.
- **[S6] Jing et al. “Understanding Dimensional Collapse in Contrastive Self-supervised Learning.” ICLR 2022.** [Full paper](https://arxiv.org/html/2110.09348). Sections 3–5: covariance-spectrum diagnostics and distinct collapse mechanisms. Visual self-supervision differs from this retrieval task.
- **[S7] Bardes, Ponce, and LeCun. “VICReg: Variance-Invariance-Covariance Regularization for Self-Supervised Learning.” ICLR 2022.** [Full paper](https://arxiv.org/html/2105.04906v3). Section 4: variance floor, covariance penalty, and unnormalized embeddings. Supports a diagnostic regularization experiment, not copying its scale settings unchanged.
- **[S8] Cormack, Clarke, and Büttcher. “Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods.” SIGIR 2009.** [Author-hosted full paper](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf). Sections 1–2: rank-only fusion, pilot choice of `k=60`, and empirical results. No universal non-regression guarantee. Both PDF pages inspected.
- **[S9] “Model-based Unbiased Learning to Rank.” WSDM 2023.** [Full paper](https://arxiv.org/html/2207.11785). Section 3 distinguishes click likelihood with a bias factor from inverse-propensity training. Its proposed simulator/doubly-robust method is more complex than the local likelihood proposed here and is not required for this first experiment.
- **[S10] PyTorch 2.12 documentation, probability distributions.** [Binomial distribution](https://docs.pytorch.org/docs/2.12/distributions.html#torch.distributions.binomial.Binomial). Constructor and `log_prob` support for aggregated count likelihood verified through Context7 against the 2.12 documentation. The exported training manifest records PyTorch 2.12.0.

### Repository evidence used

- `scripts/train-two-tower.py`, `scripts/prepare-two-tower.ts`, and `.cache/two-tower/training.json`.
- `data/clicks.manifest.json`, `data/embeddings.manifest.json`, `data/judgments.manifest.json`, and `data/models/two-tower/manifest.json`.
- `data/embeddings.bin`, `data/models/two-tower/model.json`, and `data/models/two-tower/items.bin`, read only for geometry diagnostics.
- `scripts/simulate-clicks.ts` and `src/domain/simulation/{session-sampler,latent-relevance,human-exactness-cap,build-judgments}.ts`.
- `src/domain/levels/{level-4-hybrid,level-5-cross-encoder,level-6-two-tower}.ts`.
- `src/domain/evaluation/{scorecard,recall,query-family}.ts` and `docs/chapter-6-plan.md`.

No judgment rows or test-query outcomes were used to fit a model or choose any experiment setting during this research.
