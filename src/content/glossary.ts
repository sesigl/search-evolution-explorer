/**
 * Plain-language definitions for every term the app uses before a newcomer can know it.
 * `splitTerms` marks the first occurrence of each term in a text so the UI can attach the
 * definition where the term is read, instead of sending the reader to a separate page.
 */
interface GlossaryEntry {
  /** Display forms that trigger this entry, longest first is not required. */
  readonly forms: readonly string[];
  readonly definition: string;
}

const GLOSSARY: readonly GlossaryEntry[] = [
  {
    forms: ["projection heads", "projection head", "projection layers", "projection"],
    definition:
      "A learned matrix maps a text vector into a new vector space. Chapter 11 trains different matrices for queries and items while keeping the text transformer fixed.",
  },
  {
    forms: ["held-out queries", "held-out query", "held out", "held-out"],
    definition:
      "Examples excluded from training. Chapter 11 reserves normalized query groups before creating training pairs. Validation groups select an epoch; test groups only measure the frozen model.",
  },
  {
    forms: ["temperature"],
    definition:
      "A positive scale in the training loss. A smaller temperature magnifies score differences and changes gradient strength. It is not a calibrated probability.",
  },
  {
    forms: ["judgment set", "judgments", "judged queries", "judged query"],
    definition:
      "The answer key. A fixed list of test queries and, for each query, the listings that were graded as good. Every level is scored against the same answer key, so the numbers can be compared.",
  },
  {
    forms: ["relevance grade", "relevance grades", "grade"],
    definition:
      "A number from 0 to 3 that says how good one listing is for one query. Here it is the WANDS human label: Exact = 3, Partial = 1, Irrelevant = 0. 0 = useless, 3 = exactly what was asked for. The grades are the answer key; the click log is simulated from them.",
  },
  {
    forms: ["NDCG@10", "NDCG"],
    definition:
      "A score from 0 to 1 for the first 10 results. It is 1.0 when the best listings are at the top. A good listing low in the list, or a poor listing high in the list, lowers it. Short for normalised discounted cumulative gain.",
  },
  {
    forms: ["MRR"],
    definition:
      "Mean reciprocal rank. It looks only at the first good listing: position 1 scores 1, position 2 scores 1/2, position 5 scores 1/5. The average over all test queries.",
  },
  {
    forms: ["Recall@50", "recall"],
    definition:
      "The share of all good listings that were found at all (here: in the first 50). Recall asks: did we find them?",
  },
  {
    forms: ["precision"],
    definition:
      "The share of the shown listings that are actually good. Precision asks: is what we show correct?",
  },
  {
    forms: ["false positives", "false positive"],
    definition: "A listing that was returned but is not what the searcher wanted.",
  },
  {
    forms: ["BM25"],
    definition:
      "The standard formula that scores how strongly a listing's text matches the query words. A word counts more when it is rare in the whole corpus and appears often in this listing. Very long listings are penalised a little.",
  },
  {
    forms: ["inverted index"],
    definition:
      "A table built once, ahead of time: for every word, the list of listings that contain it. Like the index at the back of a book. A query then looks up its words instead of scanning every listing.",
  },
  {
    forms: ["tokenise", "tokens", "token"],
    definition: "Split a text into single lower-case words without punctuation.",
  },
  {
    forms: ["stemming"],
    definition:
      "Cut a word to its stem, so that 'bikes', 'biking' and 'bike' all become 'bike' and match each other.",
  },
  {
    forms: ["synonym expansion", "synonyms"],
    definition: "Also search for words with the same meaning, so 'couch' also finds 'sofa'.",
  },
  {
    forms: [
      "hyphen and spacing variants",
      "variant normalisation",
      "variant collapsing",
      "variants",
    ],
    definition: "Treat 'mid-century', 'mid century' and 'midcentury' as the same word.",
  },
  {
    forms: ["candidate set", "candidates"],
    definition:
      "All listings that matched the query at all, before they are ordered. Scoring can only reorder this set. It cannot add to it.",
  },
  {
    forms: ["lexical"],
    definition:
      "About the literal words. Lexical matching finds listings that contain the query words themselves, not their meaning.",
  },
  {
    forms: ["canonical model", "canonical product type", "canonical"],
    definition:
      "One shared product language for queries and listings: product type, brand, model and relations such as compatible-with. Chapter 6 maps both sides into it from hand-written tables, so a case and a phone stop looking the same.",
  },
  {
    forms: ["search policy", "policy"],
    definition:
      "The rule that turns a query annotation into FILTER, BOOST or FEATURE. High confidence plus trusted listings filters; medium confidence only boosts; unclear listings are never filtered.",
  },
  {
    forms: ["query understanding"],
    definition:
      "Everything the engine works out about the query before it searches: the normalised words, added synonyms, a guessed category, a corrected spelling.",
  },
  {
    forms: ["static quality"],
    definition:
      "A quality score that does not depend on the query, for example how new a listing is or how complete its title is. It can be computed once for every listing.",
  },
  {
    forms: ["boosts", "boost"],
    definition:
      "A hand-chosen number added to the score when a listing has a wanted property, for example the category the query points at.",
  },
  {
    forms: ["linear model"],
    definition:
      "A score computed as weight 1 × feature 1 + weight 2 × feature 2 + ... The weights are learned from data instead of chosen by hand.",
  },
  {
    forms: ["features", "feature"],
    definition:
      "One measured property of a listing for a query, for example its BM25 score or its age. Features are the inputs of a learned model.",
  },
  {
    forms: ["weights", "weight"],
    definition:
      "The number a feature is multiplied by when the score is built. Chapter 7 picks these numbers by hand; chapter 8 learns them from clicks.",
  },
  {
    forms: ["neural network", "neural networks"],
    definition:
      "A model with many adjustable numbers that learns patterns from examples instead of being told the rules. The encoder that turns text into a vector is one.",
  },
  {
    forms: ["normalise", "normalised", "normalisation"],
    definition:
      "Rewrite a word into a standard form before looking it up, for example cut the ending or collapse 'mid century' to 'midcentury'.",
  },
  {
    forms: ["pairwise logistic loss", "pairwise loss", "pairwise", "training pairs"],
    definition:
      "A training method that takes two listings shown for the same query and pushes the model to score the clicked one higher than the skipped one.",
  },
  {
    forms: ["learning to rank", "learned ranking"],
    definition:
      "Let a model learn the scoring weights from recorded searcher behaviour instead of tuning them by hand.",
  },
  {
    forms: ["position bias"],
    definition:
      "Searchers click the top results more often whatever their quality. A model that trusts raw clicks therefore learns to copy the old ranking, mistakes included.",
  },
  {
    forms: [
      "inverse-propensity weighting",
      "inverse propensity scoring",
      "inverse-propensity weighted",
      "inverse propensity",
      "IPS",
    ],
    definition:
      "Inverse propensity scoring. Each click is divided by how often that position gets clicked, so a click far down the list counts for more than a click at the top. This removes part of the position effect from the training signal.",
  },
  {
    forms: ["propensity estimate", "propensity"],
    definition: "The probability that a searcher looks at a given position at all.",
  },
  {
    forms: ["document vectors", "document vector", "vectors", "vector", "embeddings", "embedding"],
    definition:
      "A list of a few hundred numbers that a neural network produces from a text. Texts with a similar meaning get vectors that point in a similar direction, even when they share no words.",
  },
  {
    forms: ["cosine similarity"],
    definition:
      "A number from -1 to 1 that says how much two vectors point in the same direction. 1 = the same meaning, 0 = unrelated.",
  },
  {
    forms: ["reciprocal rank fusion", "RRF"],
    definition:
      "A way to merge two ranked lists. Each listing receives 1 / (60 + its rank) from each list, and the sums are sorted. Ranks are used because the two raw scores are on different scales.",
  },
  {
    forms: ["hybrid search", "hybrid"],
    definition: "Word matching and vector matching run side by side and their lists are merged.",
  },
  {
    forms: ["ANN index"],
    definition:
      "Approximate nearest-neighbour index. A data structure that finds the closest vectors fast without comparing against every document.",
  },
  {
    forms: ["encoders", "encoder"],
    definition: "The neural network that turns a text into a vector.",
  },
  {
    forms: ["cross-encoder", "joint encoding", "jointly encodes"],
    definition:
      "A model that reads the query and one listing together and outputs one relevance score. It can compare wording across both texts, but it must run for each pair. A listing's relevance score cannot be prepared before the query arrives, so this app reranks only a short list.",
  },
  {
    forms: ["attention layers", "joint attention", "attention"],
    definition:
      "Parts of a neural network that let each token use information from other tokens. In a cross-encoder, tokens in the query can use information from the listing before the model produces a score.",
  },
  {
    forms: ["MS MARCO"],
    definition:
      "A public search dataset of queries and passages. Chapter 10 uses a model trained on these pairs. It was not trained on this app's WANDS catalog or relevance grades.",
  },
  {
    forms: ["WANDS", "Wayfair ANnotation Dataset"],
    definition:
      "The public product-search dataset this app searches. It provides the catalog (42,994 products) and the human relevance grades (Exact, Partial, Irrelevant) for the evaluated queries.",
  },
  {
    forms: ["pretrained"],
    definition:
      "Already trained on another dataset. This app downloads fixed model weights and runs them locally instead of training a new neural network.",
  },
  {
    forms: ["fine-tuning", "fine-tune", "fine-tuned"],
    definition:
      "Training a pretrained model further on your own data, so it adapts to your domain. Chapter 10 runs a pretrained model as it is. Fine-tuning it on this app's judgment set is an optional optimization, not a first step: the pretrained model already reads the query and the listing together and improves the order.",
  },
  {
    forms: ["two-tower", "independent encoding", "independent encoders", "bi-encoder"],
    definition:
      "Two encoders process queries and listings independently. Item vectors can be computed offline. The towers can share weights or use separate weights. Chapter 11 trains separate projection heads on graded preferences from training query groups, not on clicks.",
  },
  {
    forms: [
      "query head",
      "query heads",
      "item head",
      "item heads",
      "tower heads",
      "tower head",
      "heads",
    ],
    definition:
      "A small learned layer on top of a frozen text encoder. Chapter 11 learns one projection for queries and a separate one for items. Only the query head runs when a search arrives; item vectors are precomputed.",
  },
  {
    forms: ["supervision", "supervised"],
    definition:
      "Training that uses known answers. Chapter 11 learns from graded preferences: for a training query, a higher-graded listing should score above a lower-graded one.",
  },
  {
    forms: ["validation queries", "validation groups", "validation set", "validation"],
    definition:
      "Examples used to choose settings, not to fit the model or to report the final score. Chapter 11 keeps query groups separate: training fits the towers, validation selects the epoch, budget and score weight, and test queries only measure the result.",
  },
  {
    forms: ["epochs", "epoch"],
    definition:
      "One full pass over the training examples. More epochs can fit the training data better and then start to hurt new data, so validation picks which epoch to keep.",
  },
  {
    forms: ["training loss", "loss"],
    definition:
      "A number the trainer pushes down. It measures how often the model ranks a lower-graded listing above a higher-graded one. Lower training loss does not always mean better top-10 search, so validation NDCG decides what to ship.",
  },
  {
    forms: ["graded preferences", "graded preference", "pairwise preference"],
    definition:
      "Training examples built from the answer key: for one training query, a listing with a higher relevance grade is preferred to one with a lower grade. Unlike clicks, this target matches what NDCG rewards.",
  },
  {
    forms: ["neighbour budget", "nearest neighbour", "neighbours", "neighbour"],
    definition:
      "A nearby item in the trained vector space. The neighbour budget limits how many of them may enter the candidate list, so validation can trade extra recall against extra cost.",
  },
  {
    forms: ["score fusion", "score-fusion", "fusion"],
    definition:
      "Combining two scores that live on different scales. Chapter 11 adds trained similarity to joint relevance with one global weight chosen on validation queries.",
  },
  {
    forms: ["frozen transformer", "frozen"],
    definition:
      "Kept fixed during training. Chapter 11 trains only the two projection heads; the MiniLM text encoder and its weights do not change.",
  },
  {
    forms: ["gradients", "gradient"],
    definition:
      "The slope that points uphill on the loss surface. Training steps the other way, against the gradient, to lower the loss.",
  },
  {
    forms: ["singular value decomposition", "SVD"],
    definition:
      "A matrix factorisation. Chapter 11 uses it only to choose a good starting projection from the item vectors, before the heads train.",
  },
  {
    forms: ["dot product"],
    definition:
      "Multiply two vectors element by element and add the results. For unit-length vectors this equals cosine similarity, so a larger dot product means closer meaning.",
  },
  {
    forms: ["unit vectors", "unit vector", "unit-length"],
    definition:
      "A vector divided by its length so it is exactly 1 long. This removes length from the comparison, so only direction (meaning) remains.",
  },
  {
    forms: ["negative labels", "negative label", "negatives"],
    definition:
      "A listing treated as a wrong answer during training. Chapter 11 does not treat a skip as a negative; it uses the grade difference between two listings for the same query.",
  },
  {
    forms: ["reranks", "rerank", "reranking"],
    definition:
      "Take a short list that is already ranked and order it again with a slower, more precise model.",
  },
  {
    forms: ["p50 / p95", "p95", "p50"],
    definition:
      "Response-time percentiles. p50 is the median; p95 is the time that 95 of 100 queries stay under.",
  },
  {
    forms: ["regressions", "regression"],
    definition: "A test query where the higher level scores worse than the level below it.",
  },
  {
    forms: ["matching"],
    definition: "The step that decides which listings are candidates at all.",
  },
  {
    forms: ["scoring"],
    definition: "The step that decides the order of the candidates.",
  },
  {
    forms: ["ground truth"],
    definition: "The answer key the metrics are computed against; here, the judgment set.",
  },
  {
    forms: ["cascade"],
    definition:
      "A pipeline where each stage receives the output of the stage before it and narrows or reorders it.",
  },
];

export interface TextSegment {
  readonly text: string;
  /** Set when this segment is a glossary term; the definition to show. */
  readonly definition?: string;
}

const byForm = new Map<string, GlossaryEntry>();
for (const entry of GLOSSARY) {
  for (const form of entry.forms) {
    byForm.set(form.toLowerCase(), entry);
  }
}

const pattern = new RegExp(
  `(?<![\\w-])(${[...byForm.keys()]
    .sort((left, right) => right.length - left.length)
    .map((form) => form.replaceAll(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("|")})(?![\\w-])`,
  "gi",
);

/**
 * Splits `text` into plain segments and term segments. Only the first occurrence of each
 * glossary entry is marked, so a paragraph does not turn into a wall of underlines.
 */
export function splitTerms(text: string, alreadyDefined?: Set<GlossaryEntry>): TextSegment[] {
  const seen = alreadyDefined ?? new Set<GlossaryEntry>();
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const entry = byForm.get(match[0].toLowerCase());
    const start = match.index;
    if (entry === undefined || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start) });
    }
    segments.push({ text: match[0], definition: entry.definition });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }
  return segments;
}
