import type { CodeNotes } from "../domain/code/explain-module.ts";

/**
 * Numbered callouts for the code explorer. Each `at` is a substring that identifies exactly one
 * line of the module; a test checks that. Write each note in three moves: what the line does,
 * why it matters, what it is called.
 */
const CODE_NOTES: Readonly<Record<string, CodeNotes>> = {
  "src/domain/levels/level-6-two-tower.ts": {
    summary:
      "Add supervised retrieval to chapter 11. Reuse joint scores and combine them with trained similarity using one validation-selected weight.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build on the preceding cascade",
        text: "Chapter 10 still chooses and scores its first 50. This branch adds a way to retrieve listings outside that shortlist.",
      },
      {
        at: "const queryVector = projectVector(",
        title: "Run only the query head online",
        text: "The frozen text encoder already produced 384 numbers. The trained matrix maps these to 96 numbers and normalizes their length. Item vectors were computed offline with a different matrix.",
      },
      {
        at: "const hits = vectorRetrieve(",
        title: "Retrieve from the learned space",
        text: "This is an exact scan by dot product, with ID tie-breaking. It is appropriate for the small bundled inventory. No ANN behaviour or latency is invented.",
      },
      {
        at: "const additions = hits.flatMap(",
        title: "Union without duplicates",
        text: "Keep only available inventory IDs that chapter 10 did not already score. A shared hit gets one result and one joint score.",
      },
      {
        at: "const jointScores = await deps.crossEncoder.scorePairs(",
        title: "Reuse joint inference",
        text: "Only new candidates are sent through the same cross-encoder. Original joint scores are reused. A separate, inspectable formula adds trained similarity afterward.",
      },
      {
        at: "scored.set(id, combineTowerScores(",
        title: "Use the learned score in ranking too",
        text: "The same validation-selected coefficient applies to every query and candidate. Open the function to see both weighted terms. Test labels never select this coefficient.",
      },
      {
        at: "scoredByQuery.set(understanding, scored);",
        title: "A complete ranking before paging",
        text: "Each request owns its stored scores. Search, grading and comparison all sort this union, with stable ID ties, before selecting a page.",
      },
    ],
  },
  "src/domain/two-tower/combine-scores.ts": {
    summary:
      "Use the trained retrieval score as an additional ranking feature. Validation controls its scale relative to joint relevance.",
    notes: [
      {
        at: "const similarity =",
        title: "Score every candidate",
        text: "Both old and new candidates have trained item vectors. This dot product uses the same learned query vector as retrieval.",
      },
      {
        at: "score: baseline.score +",
        title: "The complete formula",
        text: "Final score equals joint relevance plus trained similarity times the saved validation weight. This is a global fitted policy, not a query-specific adjustment.",
      },
      {
        at: 'name: "twoTowerSimilarity"',
        title: "Expose the weighted term",
        text: "The results show the actual similarity and coefficient, so their displayed sum can be checked against the final score.",
      },
    ],
  },
  "src/domain/two-tower/projection.ts": {
    summary:
      "The exported linear tower head: matrix multiplication followed by unit-length normalization. Both training and serving use this operation.",
    notes: [
      {
        at: "sum += weight *",
        title: "A learned combination",
        text: "Each output dimension sums all frozen input dimensions times one row of learned weights. There is no item ID lookup in the query head.",
      },
      {
        at: "const norm =",
        title: "Remove vector length",
        text: "Divide by Euclidean length so the retrieval dot product is cosine similarity. The 96 dimensions are shared, but the query and item matrices differ.",
      },
      {
        at: 'throw new Error("Tower projection must',
        title: "Reject invalid inference",
        text: "A zero or non-finite vector has no usable direction. Fail explicitly instead of silently serving meaningless scores.",
      },
    ],
  },
  "src/domain/levels/level-0-evaluation.ts": {
    summary:
      "Level 0 is the introduction. It has no ranker: it matches nothing and scores 0, so the ladder has a floor to grade against.",
    notes: [
      {
        at: "return { items: [] };",
        title: "Matching: nothing",
        text: "Level 0 returns an empty candidate set. There is nothing to rank yet. The point of the introduction is the metric, not the ranker: see ndcgAt in src/domain/evaluation.",
      },
      {
        at: "return { item: candidate, score: 0, signals: [] };",
        title: "Scoring: zero",
        text: "Every listing gets 0 and no signals. Chapter 1 adds its recency value to this 0, so there recency is the whole score.",
      },
    ],
  },
  "src/domain/levels/level-1-recency.ts": {
    summary:
      "The first runnable chapter: strict word matching, then newest first. Matching and scoring are two separate functions.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. Chapter 1 wraps the evaluation baseline unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "return deps.index.match(matching.tokens);",
        title: "Matching: every word, exactly as typed",
        text: "The index returns listings that contain all query words, with no stemming, no synonyms and no variant collapsing. That strictness is what chapter 2 relaxes.",
      },
      {
        at: "const value = recencyScore(candidate.postedAt, clock.now().getTime());",
        title: "Scoring: how new the listing is",
        text: "Recency gives 1 for today and decays with age. It ignores the query entirely. The clock is frozen once when the level is built, so two listings posted at the same moment always score the same and the order cannot change between calls. Open recencyScore to see the one-line formula.",
      },
      {
        at: "score: base.score + value,",
        title: "Add to the level below",
        text: "The baseline scores everything 0, so here the recency value is the whole score. Later chapters replace this sum with text fit and learned weights.",
      },
    ],
  },
  "src/domain/levels/level-1-normalization.ts": {
    summary:
      "Widen chapter 1 with the recall levers: each query word becomes a group of equivalent words. The order stays newest first.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. Chapter 2 wraps chapter 1 unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "previous.match(understanding);",
        title: "Chapter 1 decides the shape",
        text: "The call stays so every level has the same shape. Chapter 1 returns strict recency candidates; chapter 2 decides its own wider candidate set below.",
      },
      {
        at: "return matchTermGroups(deps.index, termGroupsFor(",
        title: "Matching: which listings are candidates",
        text: "termGroupsFor turns each query word into a group: the variant-normalised word, its stem, and its synonyms. matchTermGroups then returns every listing that contains at least one word from every group. That is the candidate set. Open either function to see the loop.",
      },
      {
        at: "score: (understanding, candidate) => previous.score(understanding, candidate),",
        title: "Scoring is unchanged",
        text: "The chapter 1 recency score passes through untouched. Only the candidate set grows, so this chapter is tagged matching only and the score label stays newest first.",
      },
    ],
  },
  "src/domain/levels/level-1-lexical.ts": {
    summary:
      "Keep the chapter 2 candidates, then order them by how well the words fit. Matching passes through; scoring is new.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. Chapter 3 wraps chapter 2 unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "match: previous.match,",
        title: "Matching is unchanged",
        text: "Chapter 3 passes the chapter 2 match function through. The same listings are candidates; only their order can change. That is why the level is tagged scoring only.",
      },
      {
        at: "const value = bm25Score(",
        title: "Scoring: how well the words fit",
        text: "BM25 gives a listing more points when your words are rare across the corpus and appear in this listing, and fewer points when the listing is very long. Open bm25Score to see the formula line by line.",
      },
      {
        at: "(text) => analyzeDocument(text, deps.levers),",
        title: "Same analyzer as the index",
        text: "The listing text is split into terms exactly as it was when the index was built: same tokenizer, same variants, same stems. If these differed, a word could match at index time and not be counted at scoring time.",
      },
      {
        at: "score: base.score + value,",
        title: "Add to the level below",
        text: "Chapter 2 scores everything by recency. Chapter 3 adds BM25 on top, so text fit decides and recency breaks near-ties. Higher levels add to or replace this sum.",
      },
      {
        at: "signals: buildSignals(understanding, candidate, [",
        title: "The signals you see under each result",
        text: "Nothing extra is computed for display. The BM25 value and the recency base from chapter 2 are the two values shown, and they sum to the score.",
      },
    ],
  },
  "src/domain/levels/level-1-spelling.ts": {
    summary:
      "Correct the typo before lookup: unknown query words are rewritten to listing words, then chapter 3 runs on the corrected words.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. Chapter 4 wraps chapter 3 unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "const vocabulary = buildVocabulary(",
        title: "The words a correction may suggest",
        text: "Listing words normalised with the same variant rules as the query (so 'mid-century' and 'mid century' both count as 'midcentury'), each seen in at least two listings, plus tokens with digits such as 13. Stems are excluded, so a correction always points at a word a seller actually wrote. Open buildVocabulary to see the filter.",
      },
      {
        at: "const { corrected, corrections } = correctTokens(pinned, vocabulary);",
        title: "Correct first, then understand",
        text: "The pinned demo typos run first, so a corpus artifact cannot win the edit-distance race; then each unknown word becomes its unique edit-distance neighbour, or its compound split. The corrected words are re-analysed with the same levers, so chapter 3 synonyms still apply. A query with nothing to correct keeps its original understanding.",
      },
      {
        at: "return matchTermGroups(deps.index, termGroupsFor(matching, deps.levers.synonymGroups));",
        title: "Matching: the corrected words",
        text: "The same chapter 3 lookup, but on the corrected tokens. 'ligth' becomes 'light' before this line, so the candidate set is the light set. With no corrections this line matches exactly what chapter 3 matches.",
      },
      {
        at: '{ name: "spellingCorrection", value: fixes.length > 0 ? 1 : 0 },',
        title: "The flag you see above the list",
        text: "1 when a word was rewritten, else 0. The flag adds no points: the score is the chapter 3 score on the corrected words. The search page reads the applied corrections and shows what was rewritten.",
      },
    ],
  },
  "src/domain/levels/level-1-entities.ts": {
    summary:
      "Require every named attribute, but accept each in words or in listing fields. Chapter 4 candidates are kept; attribute-satisfied listings are added.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. Chapter 5 wraps chapter 4 unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "conceptsByItem.set(entry.id, extractItemConcepts(entry));",
        title: "Attributes computed once, not per query",
        text: "Every listing's colour, material, brand and product type are derived when the level is created, from the same tables the query uses. No corpus migration; purely derived and deterministic.",
      },
      {
        at: "if (concepts.length === 0) return base;",
        title: "Word queries pass through",
        text: "A query with no recognised concept returns the chapter 4 candidates unchanged. Entities only widen queries that name an attribute, so ordinary queries rank exactly as in chapter 4.",
      },
      {
        at: "if (satisfiesConcepts(concepts, tokenize(itemText(entry)), known)) {",
        title: "AND concepts, OR representations",
        text: "A listing joins when every query concept holds textually or structurally: a feature that says 'color : turquoise' satisfies colour TURQUOISE even when the title never writes 'turquoise'. Open satisfiesConcepts to see the two checks.",
      },
      {
        at: "STRUCTURED_MATCH_WEIGHT * detail.structural.length +",
        title: "Structured beats lexical",
        text: "Each structurally satisfied concept adds 1, each word-satisfied concept adds half. The chapter 4 score underneath is untouched; these points only order attribute matches above word-only ones.",
      },
    ],
  },
  "src/domain/levels/level-1-canonical.ts": {
    summary:
      "Annotate the corrected query with one canonical product family plus brand and size, then filter or boost by policy. High confidence plus trusted ads filters; medium confidence boosts; UNKNOWN ads never filter.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Build the level below first",
        text: "Every level wraps the previous one and adds one idea. This chapter wraps chapter 5 unchanged. This line is where they join; it is highlighted amber in every level file.",
      },
      {
        at: "function readAnnotation(understanding: QueryUnderstanding, previous: LevelRanker): QueryAnnotation {",
        title: "One annotation from corrected words",
        text: "Corrections come from the level below, so 'ligth bulb' tags what 'light bulb' tags. Behavior table first, deterministic parser second. The result carries product family, brand, size, confidence and source, so the policy can decide FILTER, BOOST or FEATURE.",
      },
      {
        at: "return { items: base.items.filter((entry) => keepCandidate(annotation, entry)) };",
        title: "FILTER removes, BOOST keeps",
        text: "Only FILTER removes candidates, and only known mismatches: UNKNOWN listings always survive. BOOST and FEATURE keep every candidate and add points instead. The keepCandidate rules live in src/domain/canonical/match.ts.",
      },
      {
        at: '{ name: "attributeMatch", value: matched.attributeMatch, weight: ATTRIBUTE_BOOST },',
        title: "Details add a second point",
        text: "Type agreement adds 2, brand, model and compatibility agreement adds 1 more. FILTER and BOOST share these weights; they differ only in removal. Later chapters reuse both signals as LTR features.",
      },
    ],
  },
  "src/domain/canonical/match.ts": {
    summary:
      "The keep and score rules for one annotated query against one listing. UNKNOWN never filters; known fields must agree.",
    notes: [
      {
        at: "function keepCandidate(annotation: QueryAnnotation, entry: CorpusItem): boolean {",
        title: "Three fields, UNKNOWN-safe",
        text: "No annotation means keep. UNKNOWN means keep. A known family mismatch means remove. Brand and size only remove when both sides name a value and the values differ.",
      },
      {
        at: "function brandAgrees(brand: string | null, entry: CorpusItem): boolean {",
        title: "Unknown brand agrees",
        text: "A missing brand on either side is not a mismatch: only 'kohler faucet' against a known Moen faucet filters. This keeps the false-filter rate low while still separating brands.",
      },
      {
        at: "function modelAgrees(annotation: QueryAnnotation, entry: CorpusItem): boolean {",
        title: "Size agrees",
        text: "A 'queen mattress' query keeps mattresses with no readable size and removes known king ones.",
      },
    ],
  },
  "src/domain/text/spell-correction.ts": {
    summary:
      "Edit-distance correction over the listing vocabulary: unique neighbours win, compounds split, ties and model numbers are left alone.",
    notes: [
      {
        at: "if ((token.length >= MIN_WORD_LENGTH || DIGIT.test(token)) && !seen.has(token)) {",
        title: "Count real words, once per listing",
        text: "Length 3 or more, or any token with a digit so model numbers survive. One vote per listing, so a repeated word cannot promote itself into a suggestion.",
      },
      {
        at: "const limit = token.length <= SHORT_TOKEN_LENGTH ? SHORT_TOKEN_DISTANCE : LONG_TOKEN_DISTANCE;",
        title: "Short words get less room",
        text: "One edit for words up to 4 letters, two above. A short word has many neighbours, so a wider limit would rewrite correct words.",
      },
      {
        at: "return DIGIT.test(token) || !DIGIT.test(word);",
        title: "Words stay words",
        text: "A word without a digit is never corrected into a model number. This is what keeps 'moen' from becoming a model number.",
      },
      {
        at: "return baseForm(closest);",
        title: "Ties break only for inflections",
        text: "Several candidates at the same distance usually mean the guess is unsafe, so nothing is suggested. The one exception is one word in several forms ('sofa', 'sofas'): then the base form wins. Open baseForm to see the stem check.",
      },
      {
        at: "if (isWordPart(left) && isWordPart(right) && vocabulary.has(left) && vocabulary.has(right)) {",
        title: "Split what was written as one word",
        text: "Every split position is tried; both parts must be vocabulary words. Digit parts may be short, so 'roomtables' becomes 'room' and 'tables'. Only reached when no correction won.",
      },
    ],
  },
  "src/domain/query-understanding/entities.ts": {
    summary:
      "The readable ontology both sides share: colour, material, brand and product type as plain tables, used for query and listing alike.",
    notes: [
      {
        at: '{ type: "color", value: "TURQUOISE", aliases: ["turquoise"] },',
        title: "One row of the ontology",
        text: "A concept is a type plus a value, named by its aliases. A listing whose features say 'color : turquoise' satisfies colour TURQUOISE even when its title never writes the word.",
      },
      {
        at: "return conceptsFromTokens(understanding.tokens);",
        title: "The query side",
        text: "Raw query words are scanned left to right; two-word aliases win over single words. Every concept must hold later, so this list is a conjunction.",
      },
      {
        at: "return conceptsFromTokens(tokenize(itemText(item)));",
        title: "The listing side reads its text",
        text: "Colours and materials often live in the product feature fields, which the importer folds into the description. That is the structural half of OR representations: derived fields count where words are missing.",
      },
      {
        at: "concepts: [toConcept(pair.def, [...pair.tokens]), ...parts],",
        title: "Phrases keep their words too",
        text: "A phrase such as 'tv stand' yields the phrase concept and the single-word concepts of its parts. Query and listing use this same function, so both sides agree.",
      },
      {
        at: "return queryConcepts.every(",
        title: "Every concept must hold",
        text: "One failing concept rejects the listing. Each concept passes textually (an alias in the listing words) or structurally (the derived concepts agree). No vectors, no weights; just the tables above.",
      },
    ],
  },
  "src/domain/query-understanding/understand.ts": {
    summary:
      "Query understanding shared by every chapter: the category guess, the price bound, and pinned demo-typo guesses.",
    notes: [
      {
        at: "const SPELLING_CORRECTIONS",
        title: "Demo typos, pinned",
        text: "ligth, biycicle and blk always guess light, bicycle and black, in every chapter. This is a demo guarantee, so the category guess and the vector chapters survive typos. Chapter 4 generalizes it: any unknown word is corrected against the listing vocabulary, and chapter 4 is the first that looks the corrected word up.",
      },
      {
        at: "predictedCategoryId: categoryFromTokens(tokenize(queryTextForEncoding(rawText))),",
        title: "Guessed on corrected words",
        text: "The category guess runs on the pinned corrections, so 'ligth bulb' already guesses Lighting in chapter 1. Chapter 4 additionally rewrites the words used for matching and scoring.",
      },
      {
        at: "understandingForMatching(understanding: QueryUnderstanding): QueryUnderstanding {",
        title: "Prices match nothing",
        text: "A price bound such as 'under 100' is query understanding, not listing words. Matching drops those tokens, so a budget never filters listings out by words.",
      },
    ],
  },
  "src/domain/levels/level-2-boosting.ts": {
    summary:
      "Same candidates as chapter 6. The order changes: the BM25 score gets boosts for query attributes and for static quality of the listing.",
    notes: [
      {
        at: "const quality = computeStaticQuality(deps.index.availableItems, deps.clock);",
        title: "Computed once, not per query",
        text: "Recency, title quality and price percentile for every listing, built when the level is created. Static quality means: does not depend on the query. Open computeStaticQuality to see the three numbers.",
      },
      {
        at: "match: previous.match,",
        title: "Matching is unchanged",
        text: "Chapter 7 passes the chapter 6 match function through. The same listings are candidates; only their order can change. That is why the level is tagged scoring only.",
      },
      {
        at: "const base = previous.score(understanding, candidate);",
        title: "Start from the chapter 6 score",
        text: "The chapter 6 score is the base: text match on the corrected words plus concept and canonical points, all carried over unchanged. Everything below is added to it.",
      },
      {
        at: "const categoryMatch = categoryMatchScore(understanding, candidate);",
        title: "Query attribute: category",
        text: "1 when the category predicted from your words equals the listing's category, else 0. The prediction happens before matching, in query understanding.",
      },
      {
        at: "CATEGORY_BOOST * categoryMatch +",
        title: "Hand-tuned weights",
        text: "A person chose these numbers: 2 for category, 1 for price fit, and 0.2 for each of the three static signals. They work for some queries and hurt others, and nobody can prove they are the best. Chapter 8 exists because tuning by hand does not scale.",
      },
      {
        at: "...base.signals.map((signal) => ({",
        title: "Every term of the sum is shown",
        text: "The result list shows the chapter 6 score split into its parts, each with weight 1, plus every boost with its own weight, so you can see which term moved a listing up and by how much. Recency appears twice on purpose: once as chapter 6's base (weight 1) and once as the static-quality boost (weight 0.2). Open a listing and read 'How this score was built'.",
      },
    ],
  },
  "src/domain/levels/level-3-learned.ts": {
    summary:
      "Same candidates as chapter 7. A trained linear model replaces the hand-tuned sum: the same kinds of numbers become features, and data chooses the weights.",
    notes: [
      {
        at: "match: previous.match,",
        title: "Matching is unchanged",
        text: "Chapter 8 keeps the chapter 7 (and so the chapter 6) candidates. It only changes the order.",
      },
      {
        at: "const features = extractFeatures(understanding, candidate, {",
        title: "Features, not boosts",
        text: "The same kinds of numbers as the chapter 7 boosts, now as inputs to a model instead of terms in a hand-written sum. Open extractFeatures to see how BM25 is squashed into 0 to 1 so no feature dominates.",
      },
      {
        at: "deps.model === undefined ? 0 : linearScore(deps.model, features) - deps.model.bias;",
        title: "The model: one weight per feature",
        text: "linearScore multiplies each feature by its weight and adds an intercept. The intercept is the same for every listing, so it is subtracted out: it cannot change the order. The weights come from pairwise training on clicks (npm run data:train), corrected for position bias. If the model file is missing, the level cannot run.",
      },
      {
        at: "score: learned,",
        title: "Replace, do not add",
        text: "The chapter 7 score is not added. The model replaces the hand-tuned sum entirely. The scale of the result is arbitrary: only the order of the candidates matters.",
      },
      {
        at: "...FEATURE_NAMES.map((name, index) => ({",
        title: "Show what the model saw",
        text: "Each feature is listed as a signal with the weight the model learned for it, so the learned score can be read back from its parts.",
      },
    ],
  },
  "src/domain/levels/level-4-hybrid.ts": {
    summary:
      "Matching changes again: the candidates are the chapter 8 candidates plus the listings whose vectors are closest to the query. The two rankings are fused by position.",
    notes: [
      {
        at: "const fusionByQuery = new WeakMap<QueryUnderstanding, ReadonlyMap<string, number>>();",
        title: "Fuse once per query",
        text: "match is called once, score once per candidate. The fusion is computed on the first call and cached for that query, so the two functions agree.",
      },
      {
        at: "return { items: [...scores.keys()].flatMap((id) => itemOf(byId, id)) };",
        title: "Matching: the union of two lists",
        text: "Every listing that appears in either ranking is a candidate. This is why chapter 9 can find the 'tomas chevron rug' for 'area rug' past the word boundary: the vector list needs no words in common.",
      },
      {
        at: "score: rrf,",
        title: "The fused rank is the score",
        text: "Values are small, about 0.03 at most, because each list contributes 1 divided by roughly 60 plus the rank. The scale means nothing; only the order does.",
      },
      {
        at: "const vectorSimilarity = cosineFor(understanding.queryVector, candidate.id, deps);",
        title: "Shown so you can judge the neighbour",
        text: "The cosine similarity is a signal only; it does not enter the score. Below about 0.4 the neighbour is probably off topic.",
      },
      {
        at: "const lexical = previous.match(understanding);",
        title: "Ranking 1: lexical",
        text: "The chapter 8 candidates, ordered by the chapter 8 score (rankLexical, below).",
      },
      {
        at: "const vectorIds = vectorIdsFor(understanding.queryVector, deps);",
        title: "Ranking 2: nearest vectors",
        text: "The 50 listings whose precomputed vectors are closest to the query vector. Open vectorIdsFor and then vectorRetrieve to see the brute-force loop.",
      },
      {
        at: "const fused = reciprocalRankFusion([lexicalRanked, vectorIds], RRF_K);",
        title: "Fuse by position, not by score",
        text: "BM25 values and cosine values live on different scales, so they cannot be added. Reciprocal rank fusion ignores the scores and uses positions: each list gives 1 / (60 + rank). A listing near the top of both lists wins.",
      },
    ],
  },
  "src/domain/levels/level-5-cross-encoder.ts": {
    summary:
      "Chapter 9 retrieves the candidates. A pretrained cross-encoder reads each query-listing pair and replaces the order of the first 50 with its joint relevance scores.",
    notes: [
      {
        at: "const previous = createPrevious(deps);",
        title: "Keep chapter 9's retrieval",
        text: "The previous chapter still runs lexical matching, learned ranking and vector fusion. The cross-encoder cannot retrieve a missing listing.",
      },
      {
        at: ".slice(0, RERANK_WIDTH);",
        title: "Bound the expensive work",
        text: "Only the 50 highest fused scores enter joint inference. The user sees pages of this fixed short list, so Recall@50 stays the same as chapter 9.",
      },
      {
        at: "const jointScores = await deps.crossEncoder.scorePairs(",
        title: "Read both texts together",
        text: "The adapter tokenizes the query and listing as one pair and runs a pretrained MiniLM transformer. The await is essential: matching finishes only when the joint scores are ready. The model is pinned, runs locally, and uses no evaluation grades.",
      },
      {
        at: "scoredByQuery.set(understanding, scored);",
        title: "Keep scores tied to this request",
        text: "The stored scores belong to this exact query understanding. Concurrent searches cannot overwrite each other's results.",
      },
      {
        at: '{ name: "previousRank", value: index + 1 },',
        title: "Show the old position",
        text: "The joint score determines the new order. Chapter 9's rank, RRF and vector similarity are context only. They are not added to the neural score.",
      },
    ],
  },
  "src/domain/index/inverted-index.ts": {
    summary:
      "From word to listings, instead of from listing to words. Built once at start; matching is then a lookup and a set intersection.",
    notes: [
      {
        at: "const postings = new Map<string, Set<string>>();",
        title: "The postings",
        text: "For every token, the set of listing ids that contain it. This map is the inverted index: the reverse of a document, which maps a listing to its words.",
      },
      {
        at: "const tokens = analyze(itemText(item));",
        title: "Listing text to terms",
        text: "Title and description are split into terms by the same analyzer that BM25 uses later. Each listing is analyzed once, here.",
      },
      {
        at: "documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);",
        title: "Document frequency",
        text: "How many listings contain this token. BM25 reads it: a word found in few listings is worth more than a word found in most.",
      },
      {
        at: "ids = ids === undefined ? new Set(posting) : intersect(ids, posting);",
        title: "AND across tokens",
        text: "A listing must contain every token. Starting from the first posting, each further token shrinks the set by intersection.",
      },
      {
        at: "for (const group of groups) {",
        title: "OR within a group, AND across groups",
        text: "A group is one query word with its stem and synonyms, for example rug and rugs. A listing needs any word of each group and at least one word from every group. Two query words give two groups, and both must be satisfied.",
      },
      {
        at: "function intersect(left: Set<string>, right: Set<string>): Set<string> {",
        title: "Set intersection, written out",
        text: "Keep the ids that are in both sets. No library call, so the cost is visible: one loop over the smaller set.",
      },
    ],
  },
  "src/domain/index/bm25.ts": {
    summary:
      "The textbook BM25 formula. For each query word that appears in the listing: rarity times a saturating term frequency, normalised for length.",
    notes: [
      {
        at: "const length = Math.max(tokens.length, 1);",
        title: "Same terms as the index",
        text: "The line above analyzes the listing text with the same function the index used, so query words and listing terms are in the same form. The term count is the listing length used below.",
      },
      {
        at: "termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);",
        title: "Term frequency",
        text: "How often each term appears in this listing. A word that appears twice counts more than once, but not twice as much (see the saturation below).",
      },
      {
        at: "const idf = Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));",
        title: "Inverse document frequency: rarity",
        text: "Roughly the log of how many listings do not contain the word, divided by how many do. A word in almost every listing is worth about 0; a word in one listing is worth a lot. This is why 'sofa' matters more than 'good'.",
      },
      {
        at: "const denominator = tf + K1 * (1 - B + B * (length / averageLength));",
        title: "Saturation and length normalisation",
        text: "The second occurrence of a word adds less than the first (K1 controls how fast it saturates). A listing longer than the average is penalised (B controls how much). K1 = 1.2 and B = 0.75 are the textbook defaults.",
      },
      {
        at: "score += idf * (numerator / denominator);",
        title: "Sum over the query words",
        text: "One term per query word that appears in the listing. The sum is the BM25 score you see as the bm25 signal.",
      },
    ],
  },
  "src/domain/text/analyze-query.ts": {
    summary:
      "Query understanding: your raw text becomes tokens, normalised tokens, and expanded tokens. The three levers act here.",
    notes: [
      {
        at: "const tokens = tokenize(rawText).filter((token) => !levers.stopWords.includes(token));",
        title: "Tokens",
        text: "Lowercase, split on anything that is not a letter or digit, drop stop words such as 'the'. These are the words shown as 'Your words' on the search page.",
      },
      {
        at: "? normalizeVariants(tokens, levers.variantRules)",
        title: "Variants lever",
        text: "mid century and mid-century become one spelling (midcentury). A rule list, not a model.",
      },
      {
        at: "const normalizedTokens = leverOn(overrides.stemming) ? afterVariants.map(stem) : afterVariants;",
        title: "Stemming lever",
        text: "rugs becomes rug, running becomes run. The listing side stores both the word and its stem, so a query stem can match.",
      },
      {
        at: "? expandSynonyms(normalizedTokens, synonymGroups)",
        title: "Synonyms lever",
        text: "couch becomes couch and sofa. The expanded list is what BM25 scores; termGroupsFor below decides how it matches.",
      },
      {
        at: "return understanding.normalizedTokens.map((token) => {",
        title: "One group per query word",
        text: "Each normalised word becomes a group: the word, its synonyms, and their stems. matchTermGroups requires one hit per group, so 'blue sofa' needs a blue word and a sofa-or-couch word.",
      },
      {
        at: "(candidate) => candidate === token || understanding.expandedTokens.includes(candidate),",
        title: "Levers that are off stay off",
        text: "Only synonyms that survived into expandedTokens are kept in the group. With the synonym lever off, the group is just the word itself.",
      },
    ],
  },
  "src/domain/text/analyze-document.ts": {
    summary:
      "The listing-side analyzer. Same tokenizer and variant rules as the query, and each word is stored twice: as written and as its stem.",
    notes: [
      {
        at: "const tokens = tokenize(text).filter((token) => !levers.stopWords.includes(token));",
        title: "Same first step as the query",
        text: "Tokenize and drop stop words, exactly as understandQuery does. Any difference between the two sides would make words fail to match.",
      },
      {
        at: "terms.push(stemmed);",
        title: "Store the word and its stem",
        text: "A listing that says 'rugs' is indexed under both rugs and rug. A query with stemming off still matches the exact word; with stemming on it matches the stem. The levers only change the query side.",
      },
    ],
  },
  "src/domain/signals/build-signals.ts": {
    summary:
      "Turns the numbers a level computed into the signal rows shown under each result. No new computation.",
    notes: [
      {
        at: "explanation: `${part.name} of",
        title: "One sentence per signal",
        text: "The explanation names the listing, the query and the value. The value is the same number the level used in its score.",
      },
    ],
  },
  "src/domain/ranking/features.ts": {
    summary:
      "The feature vector for the learned ranker. Six numbers per query-listing pair, each between 0 and 1, in a fixed order.",
    notes: [
      {
        at: "export const FEATURE_NAMES = [",
        title: "The order is the contract",
        text: "The model file stores one weight per position. If this list changes order, the weights apply to the wrong features. Chapter 7 uses the same list to name its signals.",
      },
      {
        at: "const bm25 = rawBm25 / (1 + rawBm25);",
        title: "Squash BM25 into 0 to 1",
        text: "Raw BM25 can be 0 to 20 or more; the other features are 0 to 1. x / (1 + x) keeps the order of the values but bounds them, so one feature cannot dominate the linear sum.",
      },
      {
        at: "const recency = recencyScore(item.postedAt, context.clock.now().getTime());",
        title: "Static features come along",
        text: "Recency and title quality are the same numbers chapter 7 used as boosts. Here the model decides their weight.",
      },
      {
        at: "termOverlap(understanding.tokens, new Set(",
        title: "Term overlap",
        text: "The share of your words, as typed, that appear in the listing text. A cheap second opinion next to BM25.",
      },
    ],
  },
  "src/domain/ranking/linear-scorer.ts": {
    summary:
      "The whole learned model at inference time: a weighted sum plus a bias. Training lives in scripts/train-ranker.ts.",
    notes: [
      {
        at: "total += weight * (features[index] ?? 0);",
        title: "Weighted sum",
        text: "Each feature times its learned weight. This is a linear model: the simplest learning-to-rank model, chosen here so the weights stay readable.",
      },
      {
        at: "if (features.length !== model.weights.length) {",
        title: "Guard the contract",
        text: "The feature vector and the weight vector must have the same length and order. Failing loudly is better than a silently wrong ranking.",
      },
    ],
  },
  "src/domain/fusion/reciprocal-rank-fusion.ts": {
    summary:
      "Combine rankings from systems with incompatible scores by using positions only. Each list votes 1 / (k + rank) for each item.",
    notes: [
      {
        at: "scores.set(itemId, (scores.get(itemId) ?? 0) + 1 / (k + offset + 1));",
        title: "One vote per list, by position",
        text: "Rank 1 gives 1 / 61, rank 2 gives 1 / 62, and so on with k = 60. The large k flattens the gap between top ranks so a single list cannot dominate. Scores of the source lists are never read: this is why BM25 and cosine can be combined.",
      },
      {
        at: ".sort(compareScoreThenId)",
        title: "Deterministic order",
        text: "Highest fused score first; ties are broken by id so the same query always gives the same order.",
      },
    ],
  },
  "src/domain/vector/vector-retrieval.ts": {
    summary:
      "Nearest neighbours by brute force: compare the query vector with every listing vector, keep the top hits.",
    notes: [
      {
        at: "for (const itemId of store.itemIds()) {",
        title: "Every listing, every query",
        text: "A full scan is fine for a few thousand listings. Real systems use an ANN index (approximate nearest neighbour) so this loop does not grow with the catalogue.",
      },
      {
        at: "total += (left[index] ?? 0) * (right[index] ?? 0);",
        title: "Dot product equals cosine here",
        text: "The vectors are unit length (normalised when they were encoded), so the dot product is the cosine of the angle between them: 1 means the same direction, 0 means unrelated.",
      },
    ],
  },
  "src/domain/signals/static-quality.ts": {
    summary:
      "Three query-independent numbers per listing: how recent it is, how complete the title looks, and where its price sits in its category.",
    notes: [
      {
        at: "const recency = recencyScore(item.postedAt, now);",
        title: "Recency",
        text: "1 for a listing posted today, about 0.5 after one day, small after a month. The catalog prefers fresh listings (here postedAt is a synthetic overlay; WANDS has no date).",
      },
      {
        at: "return Math.min(title.length / TITLE_LENGTH_NORM, 1);",
        title: "Title quality",
        text: "A stand-in for completeness: longer titles up to 40 characters score higher. Crude, and that is the point of chapter 7.",
      },
      {
        at: "return index / Math.max(sortedPrices.length - 1, 1);",
        title: "Price percentile",
        text: "0 for the cheapest listing in its category, 1 for the most expensive. A hand-picked assumption that pricier listings are better; the learned model in chapter 8 can disagree.",
      },
    ],
  },
  "src/domain/signals/recency.ts": {
    summary: "Age in days turned into a number between 0 and 1: 1 / (1 + days).",
    notes: [
      {
        at: "return 1 / (1 + ageDays);",
        title: "Decay by age",
        text: "Today gives 1, one day gives 0.5, nine days give 0.1. Smooth and never zero.",
      },
    ],
  },
  "src/domain/signals/price-fit.ts": {
    summary:
      "1 when the listing's price is inside the price range read from the query, 0 when outside, 0 when the query has no range.",
    notes: [
      {
        at: "if (constraint === null) {",
        title: "No range, no boost",
        text: "Most queries carry no price, so this signal is 0 most of the time. It only moves listings when you typed something like 'under 200'.",
      },
    ],
  },
  "src/domain/text/tokenize.ts": {
    summary: "Lowercase and split on anything that is not a letter or a digit.",
    notes: [
      {
        at: "return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];",
        title: "The whole tokenizer",
        text: "One regular expression. 'Blue-Sofa, 2x' becomes blue, sofa, 2x. Accented letters are dropped; that is a known limit of this lesson corpus.",
      },
    ],
  },
  "src/domain/text/stem.ts": {
    summary: "Porter stemming through the stemmer package: rugs to rug, running to run.",
    notes: [
      {
        at: "return stemmer(token);",
        title: "Rule-based, not a dictionary",
        text: "The Porter algorithm strips suffixes by rules. The result is not always a word (pony becomes poni), but the same input always gives the same output on both sides.",
      },
    ],
  },
  "src/domain/text/expand-synonyms.ts": {
    summary:
      "Add every word that shares a synonym group with a query word. Groups are a hand-written list.",
    notes: [
      {
        at: "if (group.includes(token)) {",
        title: "Group membership",
        text: "If the token is in a group, every other word of that group is added once. sofa and couch are one group; so are rug and carpet.",
      },
    ],
  },
  "src/domain/text/normalize-variants.ts": {
    summary: "Rewrite known spelling variants to one canonical form with a rule list.",
    notes: [
      {
        at: "normalized = normalized.replaceAll(rule.pattern, rule.canonical);",
        title: "One rule at a time",
        text: "Rules run on the joined text so multi-word variants such as 'mid century' can become 'midcentury'. Then the text is split again.",
      },
    ],
  },
  "src/domain/text/term-overlap.ts": {
    summary: "The share of query words found in the listing: hits divided by query length.",
    notes: [
      {
        at: "return hits / queryTokens.length;",
        title: "A fraction between 0 and 1",
        text: "Unlike BM25 it ignores rarity and length; it only asks how many of your words are present.",
      },
    ],
  },
  "src/domain/text/item-text.ts": {
    summary: "Title and description joined: the text that is indexed and scored.",
    notes: [],
  },
  "src/domain/sort-score.ts": {
    summary: "Order by score, highest first; equal scores are ordered by id so results are stable.",
    notes: [],
  },
};

export function codeNotesFor(path: string): CodeNotes | undefined {
  return CODE_NOTES[path];
}

export function annotatedModulePaths(): readonly string[] {
  return Object.keys(CODE_NOTES);
}
