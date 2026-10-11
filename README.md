# Search Evolution Explorer

A local-first Astro app that teaches how a search system evolves, from lexical match through hybrid retrieval and cross-encoder reranking.

## Setup

Node 24 or later is required. Chapter 11 training and its training tests also need Python 3.12+,
NumPy and PyTorch. Serving uses Node only.

```bash
npm install
python3 -m pip install -r scripts/requirements-two-tower.txt
npm run data:all
npm run dev
```

The corpus and judgments ship committed under `data/`. The catalog and the human
labels come from WANDS (Wayfair ANnotation Dataset). Download the release once into
`data/wands/` (not committed), then build. Derived artifacts are built locally:

| Command | Artifact |
|---|---|
| `npm run data:wands` | `data/corpus.ndjson`, `data/judgments.ndjson` (from `data/wands/`) |
| `npm run data:clicks` | `data/clicks.ndjson` (simulated from the WANDS grades) |
| `npm run data:bias-models` | `data/models/bias-naive.json`, `data/models/bias-corrected.json` |
| `npm run data:train` | `data/models/ranker-naive.json`, `data/models/ranker-corrected.json` |
| `npm run data:embeddings` | `data/embeddings.bin` (downloads the MiniLM encoder into `.cache/` once) |
| `npm run data:cross-encoder` | pinned MiniLM cross-encoder and tokenizer in `.cache/` |
| `npm run data:two-tower` | trained query/item heads, item vectors and provenance in `data/models/two-tower/` |
| `npm run data:precompute` | `data/precomputed/results.json`: scorecards and bias lesson for the deployed app (needs `npm run dev` running) |
| `npm run data:all` | WANDS import, embeddings, clicks, ranker training, cross-encoder download, then tower training |

Run `npm run data:precompute` again after a change to `src/domain` or to the data files, then commit the file. The deployed app serves the scorecard and the bias lesson from it while its fingerprint matches the current code and data. If the fingerprint does not match, the app computes them live, which takes longer than one serverless request may run.

Levels 1 to 7 run without derived artifacts. Chapter 8 needs the ranker files. Chapter 9 needs embeddings and a local model cache. Chapter 10 needs the corrected ranker, current embeddings, and the cross-encoder cache. Chapter 11 needs the two-tower artifact. For an existing setup, run `npm run data:cross-encoder` and restart the app. The setup command downloads and checks the pinned `Xenova/ms-marco-MiniLM-L-6-v2` model. Search runs offline. This model was pretrained on MS MARCO; no local click training or evaluation judgments are used to build it.

The Position bias page uses `data/clicks.ndjson`. The clicks were simulated from the
WANDS human grades and the chapter 2 ranking, with a position-decay model, so the
answer key and the click log are separate processes. Both files are committed, so
serving stays deterministic.

Chapter 11 extends Chapter 10 with trained retrieval. Open `/search?level=level-6-two-tower`.
The same search page contains five learning stages: run before/after searches, explore the training
loss, inspect actual result signals, compare measured scorecards, and answer operational questions.
The training source and references expand in place.

Vitest is pinned to `4.1.10`. Vitest `5.0.0` was specified in the plan, but Stryker 10 does not activate mutants under Vitest 5 (every mutant survived while the same change failed under Vitest 4). Mutation testing is a constitution gate, so the working pair is used.

## Verify

One command runs every quality gate:

```bash
npm run verify
```

CI invokes that same command and defines no checks of its own.

The gates and what each one enforces:

| Gate | Enforces |
|---|---|
| `check` (Biome) | formatting and lint, error-free |
| `typecheck` | `tsc --noEmit` |
| `arch` | dependency-cruiser: domain has no outbound app imports, only `src/di.ts` imports adapters, no cycles, a level module imports only the level below |
| `knip` | no unused files, exports, types or dependencies |
| `dupes` | jscpd, zero clones |
| `test` | Vitest with coverage: lines ≥ 80%, branches ≥ 70%, `src/domain/**` lines ≥ 95% |
| `check:corpus`, `check:content`, `check:levels`, `check:examples` | corpus and authored-content invariants; `check:examples` proves each chapter ships a guided example |
| `mutation` | Stryker over `src/domain/{index,ranking,evaluation}`: score ≥ 85% |
| `crap` | CRAP ≤ 30 for every function in `src/domain` and `src/actions` |

The CRAP gate scores `src/actions`, so `vitest.config.ts` measures that directory too. A new action needs a test.

### Search quality

With the app running, evaluate the same serving path used by search, comparison, grading and checkpoints:

```bash
npm run evaluate
# Or: npm run evaluate -- http://localhost:4322
```

This prints NDCG@10, MRR, Recall@50 and retrieval/ranking latency for every ready chapter. It also re-runs every implemented chapter's guided example against the same live pipeline and fails if one no longer holds. It saves all per-query scores and regressions to `reports/qa/search-evaluation.json`, including Chapter 11's held-out query comparison. Adjacent chapters run together for each query so Chapter 11 can reuse Chapter 10's joint scores. Both scorecards use those same measured runs. Chapter 11 timing therefore measures incremental work after Chapter 10, not its standalone end-to-end latency. Text encoding is outside these timings. The full scorecard is cached per app process; restart the app for fresh measurements. The first build over the full 42,994-product catalog and 246 judged queries takes several minutes on a laptop, because the cross-encoder reranks 50 pairs per query; later loads are instant.

The judgment set is fixed across chapters. Reranking the same first 50 candidates can improve their order, but cannot increase Recall@50. Query normalization is identical in search and evaluation. Earlier chapters' checkpoints do not wait for Chapter 10's full neural evaluation.

Measured on 2026-09-24 over all 246 evaluated WANDS queries with the committed catalog and pinned models. Chapter 1 (recency) scores NDCG@10 0.3926, MRR 0.6451, Recall@50 0.0908: exact words plus newest-first ignores relevance by design. Chapter 2 beats it by finding synonyms (rug for carpet) and variants (mid century for midcentury): 0.4205. Chapter 3 keeps those candidates and orders them by text fit with BM25: 0.5381. Chapter 4 adds spelling correction and edges past it at 0.5405 by rewriting real typos such as `ligth` to `light`. Chapter 5 adds entity-tagged matching and jumps to 0.5758 by resolving colour, material and brand that words alone miss. Chapters 6 to 8 inherit that match set. Latency is machine-dependent; the entity chapter scans the whole catalog for attribute matches, so its p50 is higher than BM25. Recency features depend on the process-start clock, so chapter 1 moves by a few ten-thousandths between runs.

| Chapter | NDCG@10 | MRR | Recall@50 | p50 ms |
|---|---|---|---|---|
| 1 Recency search | 0.3926 | 0.6451 | 0.0908 | 0 |
| 2 Query normalization | 0.4205 | 0.6998 | 0.1041 | 2 |
| 3 Lexical match | 0.5381 | 0.7911 | 0.1144 | 3 |
| 4 Spelling normalization | 0.5405 | 0.7951 | 0.1150 | 4 |
| 5 Entity-tagged matching | 0.5758 | 0.8551 | 0.1494 | 287 |
| 6 Canonical search policy | 0.5769 | 0.8551 | 0.1497 | 288 |
| 7 Attribute boosting | 0.5780 | 0.8585 | 0.1501 | 289 |
| 8 Learning to rank | 0.5787 | 0.8565 | 0.1494 | 287 |
| 9 Hybrid search | 0.6536 | 0.9245 | 0.2257 | 324 |
| 10 Cross-encoder reranking | 0.6906 | 0.9337 | 0.2257 | 704 |
| 11 Supervised two-tower + score fusion | **0.7042** | **0.9413** | **0.2308** | 367 (incremental) |

Chapter 4 (spelling) edges just past chapter 3 on the whole WANDS set (0.5405 against 0.5381). The pinned demo typos (`ligth`, `biycicle`, `blk`) are corrected before the edit-distance search, so the correction is the intended word and not a corpus artifact. Edit-distance correction can still rewrite a correct word, so the margin is thin and the checkpoint shows it.

Chapters 6 to 8 sit close together: the canonical policy and the hand-tuned boosts add little on top of entity matching on this catalog, and the learned model trained on the simulated WANDS-grade click log only just edges past the hand-tuned one (0.5787 against 0.5780). The scorecard shows that instead of asserting a bigger gain.

Chapter 10 raises NDCG@10 by 0.0370 and MRR by 0.0092 over chapter 9, at equal Recall@50, because it reorders the same short list. It is better on average, not on every query: 70 of 246 queries still score below chapter 9. The per-query rows and regressions are in `reports/qa/search-evaluation.json`.

### Chapter 11 evidence and reproducibility

The shipped model uses **training-query relevance judgments** (WANDS grades), not click/skip labels. Query groups are split before supervision: 169 training, 27 validation and 50 test groups. The item representation mixes 80% title embedding with 20% full-text embedding because many descriptions are off topic. Separate 384→96 heads start from an inventory-only SVD projection and are regularized toward it.

Validation retrieval NDCG selects epoch 1 (0.608 against 0.585 for the untrained projection). A separate validation grid selects 10 neighbours and the global formula `joint relevance + 2 × trained similarity`; a wider weight of 16 scored lower. Thus the retrieval branch adds at most 10 new candidates per query, which the shared cross-encoder then scores. Query-specific score overrides are not used.

| Fixed test subset (50 queries) | NDCG@10 | MRR | Recall@50 |
|---|---:|---:|---:|
| Chapter 10 | 0.7054 | 0.9500 | 0.1894 |
| Chapter 11 | **0.7122** | **0.9617** | **0.1955** |

All-query NDCG improves by 0.0136, with 37 of 246 queries still regressing. The all-query view includes training and validation queries. Test labels are excluded from fitting and selection. The labels are WANDS human grades; the click log is simulated.

On validation queries, the selected policy scores 0.7301 NDCG, compared with 0.7271 for the cross-encoder control, 0.7210 for a wider hybrid-100 control, and 0.7202 for an untrained title-vector expansion control. Those controls have different maximum candidate budgets; they are not equal-cost serving runs. The full grid and actual epoch history are stored in `data/models/two-tower/manifest.json` and are available in the interactive Train and Evaluate stages.

`npm run evaluate` fails if Chapter 11 is unavailable, has an empty test set, or fails to improve
overall NDCG while preserving MRR and Recall@50. The artifact loader verifies input/file hashes,
dimensions, vector lengths, query-split separation and Python/TypeScript projection parity.
Recency features use the process-start clock, so cross-process timing and small earlier-chapter
ranking differences are possible even with unchanged artifacts. Rebuild and restart before
recording a new snapshot.

## Architecture gate

`npm run arch` enforces four dependency-cruiser rule families: domain must not import adapters, pages, or components; only `src/di.ts` may import adapters; no cycles; a level module may import only the level below it.

This was proven on 2026-09-09: a temporary `src/domain/text/stem.ts` import of `src/adapters/probe.ts` made `npm run arch` fail with `domain-no-adapters-pages-components` and `only-di-imports-adapters`. The import was then reverted.

## Ladder map

| Level | Module |
|---|---|
| 0 Evaluation | `src/domain/levels/level-0-evaluation.ts` |
| 1 Recency search | `src/domain/levels/level-1-recency.ts` |
| 2 Query normalization | `src/domain/levels/level-1-normalization.ts` |
| 3 Lexical match | `src/domain/levels/level-1-lexical.ts` |
| 4 Spelling normalization | `src/domain/levels/level-1-spelling.ts` |
| 5 Entity-tagged matching | `src/domain/levels/level-1-entities.ts` |
| 6 Canonical search policy | `src/domain/levels/level-1-canonical.ts` |
| 7 Attribute boosting | `src/domain/levels/level-2-boosting.ts` |
| 8 Learning to rank | `src/domain/levels/level-3-learned.ts` |
| 9 Hybrid search | `src/domain/levels/level-4-hybrid.ts` |
| 10 Cross-encoder reranking | `src/domain/levels/level-5-cross-encoder.ts` |
| 11 Two-tower retrieval | `src/domain/levels/level-6-two-tower.ts` |

Level ids keep their historical `level-N` prefix; the ordinal decides the chapter order. Composition root: `src/di.ts`. Pages call actions; actions call `di.ts`; domain never imports adapters.

## Beyond the ladder

`/beyond` states the boundary of this book. It runs two frontier ideas on the same results: a grounded answer with a source checker (the retrieve–cite–verify loop of RAG, with a template writer instead of a language model) and a transparent personalisation boost. It also names, one by one, what is deliberately not built: knowledge graphs, learned user models, click-model families, active learning and A/B tests, approximate nearest neighbours, LLM fine-tuning and multimodal search.

## Performance budget (SC-006)

Chapters 1-9 are specified to return within 2 seconds on a developer laptop. The current catalog has 42,994 products. Recency and lexical search return in well under 100 ms once the inverted index is in memory. Chapters 4 and 5 add a vocabulary lookup and concept checks per candidate; chapter 5 scans the whole catalog when the query names an attribute, so it is the slowest lexical chapter. Chapter 8 adds a linear score per candidate. Chapter 9 encodes one query vector; document vectors are precomputed.

Chapter 10 scores at most 50 query-listing pairs in batches of 8, with at most 256 model tokens per pair. Its raw joint score determines the order. The previous rank and retrieval signals are shown as context. Inference is serialized and the last 64 exact requests are cached, so paging reuses scores. The first full scorecard takes several minutes on the full WANDS catalog because it evaluates every judged query and reranks 50 pairs per query.
