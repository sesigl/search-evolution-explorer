# Equivalent Stryker survivors

Measured after killing killable mutants in ranking, scoring, index, and
evaluation. Remaining survivors are equivalent under the types and call
sites that exist today. `NO_COVERAGE` rows are listed only where they
are the same dead path.

## evaluation/ndcg.ts

- `if (itemId !== undefined)` → `true`: the loop bound is
  `index < min(k, rankedIds.length)`, so a dense `string[]` always has a
  value at `index`.

## evaluation/scorecard.ts

- `queryVector === undefined` → always pass `queryVector`: `runSearch`
  reads `input.queryVector === undefined` again, so `{ queryVector: undefined }`
  matches an omitted field.
- `requireLevel` before search (call and loop body): `runSearch` calls
  `requireImplementedLevel`, which throws the same unknown-id error.
- empty `percentile` (`length === 0` → `false`, and the uncovered
  `return 0` block): `assembleScorecard` rejects empty judgments, so
  `times` is never empty.
- `Math.min(sorted.length - 1, floor((p/100)*(n-1)))` vs `length + 1`:
  the floor expression is already in `[0, n-1]`.

## index/bm25.ts

- `if (tf > 0)` → `true`, and `tf > 0` → `tf >= 0`: term frequency is a
  count, so `tf` is never negative. When `tf === 0` the Robertson formula
  adds `0`.

## index/inverted-index.ts

- empty `queryTokens` / empty `groups` early return (block emptied or
  condition forced false): `ids` stays `undefined` and `itemsFromIds`
  already returns `[]`.
- `ids ?? []` (uncovered): only used when `ids` is `undefined`, which is
  the empty-input path above.
- `if (item !== undefined)` → `true`: posting lists only contain ids that
  were written into `byId`.

## ranking/feature-lookup.ts

- `understand(..., ["Stryker was here"])`: the categories argument is unused.
- understanding cache (`if (understanding === undefined)` → `true`, and
  dropped `.set`): a cache miss recomputes the same vector; the feature
  cache already makes the observable return value stable.

## ranking/features.ts

- `predictedCategoryId !== null &&` → `true &&`: `item.categoryId` is a
  string, so `null === item.categoryId` is never true.

## ranking/pairwise-trainer.ts

- `if (example !== undefined)` → `true`: shuffle yields indexes in
  `0..length-1` of a dense examples array.

## ranking/propensity.ts

- `Array.from({ length: maxRank }, () => 0)` vs `() => undefined` or
  `Array.from({})`: later updates use `clicks[offset] ?? 0`, so a missing
  seed is counted as 0.
