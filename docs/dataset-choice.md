# Dataset choice: WANDS as the catalog and the answer key

## Decision

The searchable catalog and the relevance answer key come from **WANDS (Wayfair
ANnotation Dataset)**, https://github.com/wayfair/WANDS — MIT licence.

- Catalog: `product.csv`, 42,994 products, mapped to the app's `CorpusItem`.
- Answer key: `label.csv`, 233,448 human labels, `Exact` / `Partial` / `Irrelevant`,
  mapped to grades `3` / `1` / `0`.
- Queries: `query.csv`, 480 real shopping queries. The evaluated set keeps the queries
  with enough `Exact` and `Irrelevant` labels, plus a fixed set of teaching queries.

`scripts/import-wands.ts` performs the import. The committed outputs are the source of
truth: `data/corpus.ndjson` and `data/judgments.ndjson`. The raw release is downloaded
once into `data/wands/` and is not committed.

## Why WANDS

- Real human labels replace a self-made relevance function. Before this decision the
  app graded itself with a hand-tuned latent-relevance rule, and the README had to
  disclose that the clicks and the grades came from one hidden function. WANDS removes
  that circularity.
- Rich product metadata: `product_class`, `category_hierarchy`, `product_features`
  (colour, material, dimensions), `average_rating` and `review_count`. This feeds the
  entity-matching and attribute-boosting chapters directly.
- The real query set already contains the cases the chapters teach: genuine typos
  (`ligth bulb`, `biycicle plant stands`), hyphen/spacing variants (`mid century` vs
  `mid-century`), synonyms (`sofa` / `couch` / `loveseat`), colours, materials, brands
  and model numbers.
- It is a public benchmark with a published reranking protocol, so the task is well
  defined, not just self-consistent. The app scores over the full 42,994-product catalog
  rather than the per-query judged pool, which is the harder task, so the numbers are not
  directly comparable with published leaderboard values.

## Honest limits

- WANDS is English home and furniture retail. Ranking techniques transfer to other
  catalogs; language and assortment do not.
- WANDS has **no price and no date**. `priceCents` and `postedAt` are deterministic
  synthetic overlay columns derived from the product id, so the price-fit and recency
  chapters keep a live signal. `data/corpus.manifest.json` marks them as synthetic.
- Each query was annotated against a pooled candidate set, so scoring over the full
  42,994-product catalog is a harder task than reranking the judged pool. Recall@50 is
  a secondary metric here for the same reason.
- The click log is simulated from the WANDS grades and the chapter 2 ranking with a
  position-decay model. It is not observed behaviour, and the position-bias page says so.

## Rejected

- **Amazon ESCI**: 130k queries and 2.6M labels, but sparse product metadata (title,
  description, bullets). The entity and attribute chapters need colour, material and
  category fields, which WANDS provides and ESCI does not. Also no price or date.
- **Avito**: closest to classifieds text, but Russian-only, no query-to-product
  ranking labels, and competition terms restrict redistribution.
- **Amazon Berkeley Objects / Reviews 2023**: catalogs without queries or judgments.
- **Billiger.de**: German text but no query-to-product ranking labels.
- **Hand-planted corpus**: the previous catalog and the synthetic latent-relevance
  answer key. It was removed with this decision.

## What this replaced

- The hand-planted corpus and its hand-tuned latent-relevance function.
- The simulated clicks that drew from that function.

The ladder, the level modules, the scorecard and the guided examples stay. The examples
are re-pointed to real WANDS queries and products; the lesson text stays.
