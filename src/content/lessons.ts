/**
 * One lesson per level, always in the same four steps: the naive approach, the problem it
 * runs into, how the problem is solved, and what that solution is called. Terms are named
 * last, after the reader has seen the behaviour they describe.
 */
export interface LessonTry {
  readonly label: string;
  readonly query: string;
  /** Level to run the query at; defaults to the lesson's own level. */
  readonly levelId?: string;
  readonly levers?: { stemming: boolean; synonyms: boolean; variants: boolean };
  /** Grade the query in the introduction's lab instead of searching. */
  readonly grade?: boolean;
}

interface LessonLink {
  readonly label: string;
  readonly href: string;
}

export interface LessonStep {
  readonly kind: "naive" | "problem" | "solution" | "name";
  readonly text: string;
  readonly tries?: readonly LessonTry[];
  /** Places to open next, shown under the step: another chapter, the lab, or the source. */
  readonly links?: readonly LessonLink[];
}

export interface Lesson {
  readonly levelId: string;
  /** The everyday question this level answers, free of jargon. */
  readonly question: string;
  readonly steps: readonly LessonStep[];
  /** What to look at in the source of this level. */
  readonly codeFocus: string;
}

const ALL_ON = { stemming: true, synonyms: true, variants: true };

const LESSONS: readonly Lesson[] = [
  {
    levelId: "level-0-evaluation",
    question: "How do we know whether a search is good?",
    steps: [
      {
        kind: "naive",
        text: "Type a few queries, look at the top results, and decide by eye whether they look right. Before you press, guess: will chapter 1 score above half on 'pool floats', or below?",
        tries: [
          {
            label: "Grade chapter 1 for 'pool floats'",
            query: "pool floats",
            levelId: "level-1-recency",
            grade: true,
          },
        ],
      },
      {
        kind: "problem",
        text: "Two people judge the same list differently, and nobody can re-check a hundred test queries by eye after every change. Without a written answer key, 'better' is an opinion.",
      },
      {
        kind: "solution",
        text: "Write the answer key once: for each test query, give every listing a grade from 0 (useless) to 3 (exactly it). WANDS already provides those grades: Exact is 3, Partial is 1, Irrelevant is 0. A formula then turns any ranking into one number between 0 and 1. Higher is better, for everyone, every time. Now grade the same query at chapter 7 and watch the number move.",
        tries: [
          {
            label: "Grade chapter 7 for 'pool floats'",
            query: "pool floats",
            levelId: "level-2-boosting",
            grade: true,
          },
        ],
        links: [
          { label: "Open the lab and grade a top 10 →", href: "/search?level=level-0-evaluation" },
        ],
      },
      {
        kind: "name",
        text: "The answer key is the judgment set. The numbers per listing are relevance grades. The one number per ranking is NDCG@10. Every chapter of this book ends with a checkpoint that shows this number for the chapter and the chapter before it. That is how you will see the search improve.",
        links: [{ label: "NDCG@10 for every chapter →", href: "/scorecard" }],
      },
    ],
    codeFocus:
      "The introduction has no ranker. Its code is the metric: ndcgAt in src/domain/evaluation.",
  },
  {
    levelId: "level-1-recency",
    question: "Show the newest listings first",
    steps: [
      {
        kind: "naive",
        text: "Go through every listing and keep the ones whose text contains the query word. Order the kept listings newest first.",
        tries: [{ label: "Search 'sofa'", query: "sofa" }],
      },
      {
        kind: "problem",
        text: "'couch' finds couch listings but no sofa-only listing: this chapter has no word switches yet, so nothing bridges the gap between the two words. 'carpet' finds carpet listings but no rug that is titled 'rug'. And a fresh but weak match outranks the best match, because only age decides the order. Before you press, guess: for 'carpet', will it find one listing — or every rug?",
        tries: [
          {
            label: "'couch' misses the sofa-only listing",
            query: "couch",
          },
          {
            label: "'carpet' finds no rug",
            query: "carpet",
          },
        ],
        links: [
          {
            label: "How one word table makes this fast →",
            href: "/level/level-1-recency?file=src/domain/index/inverted-index.ts",
          },
        ],
      },
      {
        kind: "solution",
        text: "Build a word table once, ahead of time: for every word, the listings that contain it. Look the query words up exactly as typed: keep only listings that contain every query word, then order them newest first.",
        tries: [{ label: "'sofa' newest first", query: "sofa" }],
      },
      {
        kind: "name",
        text: "The word table is an inverted index. Ordering by age only is recency ranking. Chapter 2 adds three switches that change which words are looked up: stemming, synonym expansion and variant normalisation. WANDS has no date, so the posted date here is a deterministic synthetic overlay column spread over 180 days: many listings share a date, and those ties fall to a stable id order rather than to a finer clock.",
        links: [
          {
            label: "Read the recency formula →",
            href: "/level/level-1-recency?file=src/domain/signals/recency.ts",
          },
        ],
      },
    ],
    codeFocus:
      "match looks the query words up in the inverted index with AND semantics, exactly as typed. score returns only the recency value.",
  },
  {
    levelId: "level-1-normalization",
    question: "Meet the seller halfway on words",
    steps: [
      {
        kind: "naive",
        text: "Look the words up exactly as typed, as chapter 1 does.",
        tries: [
          {
            label: "'couch' at chapter 1",
            query: "couch",
            levelId: "level-1-recency",
          },
        ],
      },
      {
        kind: "problem",
        text: "'couch' finds no sofa. 'carpet' finds no rug. 'mid century' finds no 'midcentury' listing. Searchers do not use the seller's exact word. Before you press, guess which one switch rescues 'couch'.",
        tries: [
          {
            label: "'couch' finds no sofa",
            query: "couch",
            levers: { stemming: true, synonyms: false, variants: true },
          },
          {
            label: "'carpet' finds no rug",
            query: "carpet",
            levers: { stemming: true, synonyms: false, variants: true },
          },
          {
            label: "'mid century' without variants",
            query: "mid century",
            levers: { stemming: true, synonyms: true, variants: false },
          },
        ],
        links: [
          {
            label: "How one word table makes this fast →",
            href: "/level/level-1-normalization?file=src/domain/index/inverted-index.ts",
          },
        ],
      },
      {
        kind: "solution",
        text: "Keep the word table, change what is looked up: before lookup, normalise each query word. Cut its ending, add words with the same meaning, collapse spelling variants. The order stays newest first.",
        tries: [
          { label: "'couch' with all three on", query: "couch", levers: ALL_ON },
          { label: "'carpet' with all three on", query: "carpet", levers: ALL_ON },
          { label: "'mid century' with all three on", query: "mid century", levers: ALL_ON },
        ],
      },
      {
        kind: "name",
        text: "The three switches are stemming, synonym expansion and variant normalisation. Each switch gains recall (finds more) and loses precision (some extra finds are wrong).",
        links: [
          {
            label: "Read how the switches rewrite the query →",
            href: "/level/level-1-normalization?file=src/domain/text/analyze-query.ts",
          },
        ],
      },
    ],
    codeFocus:
      "match turns each query word into a group of equivalent words and looks the groups up in the inverted index. score is passed through unchanged from chapter 1, so the order is still newest first.",
  },
  {
    levelId: "level-1-lexical",
    question: "Order by text fit, not by age",
    steps: [
      {
        kind: "naive",
        text: "Order the candidates by age only, as chapter 2 does.",
        tries: [
          {
            label: "'sofa' at chapter 2",
            query: "sofa",
            levelId: "level-1-normalization",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "A fresh but weak match outranks the best match, because only age decides the order. And reading every listing for every query is slow. Open the first link and guess the rank of the best sofa before you look.",
        links: [
          {
            label: "See chapter 2 order 'sofa' newest first →",
            href: "/search?q=sofa&level=level-1-normalization&stemming=1&synonyms=1&variants=1",
          },
          {
            label: "How one word table makes this fast →",
            href: "/level/level-1-lexical?file=src/domain/index/inverted-index.ts",
          },
        ],
      },
      {
        kind: "solution",
        text: "Keep the chapter 2 candidates unchanged. Then order them by how strongly their text matches: rare query words count most, repeated words count with diminishing returns, and long listings are normalised by length.",
        tries: [{ label: "'sofa' ordered by fit", query: "sofa", levers: ALL_ON }],
      },
      {
        kind: "name",
        text: "The ordering formula is BM25. Matching and scoring are now separate: the switches decide which listings match, and BM25 decides their order, with recency breaking near-ties.",
        links: [
          {
            label: "Read the BM25 formula →",
            href: "/level/level-1-lexical?file=src/domain/index/bm25.ts",
          },
        ],
      },
    ],
    codeFocus:
      "match is passed through unchanged from chapter 2. score adds the BM25 formula on top of the recency base.",
  },
  {
    levelId: "level-1-spelling",
    question: "What if I mistype a word?",
    steps: [
      {
        kind: "naive",
        text: "Look the word up exactly as typed, as chapter 3 does.",
        tries: [
          {
            label: "'ligth bulb' at chapter 3",
            query: "ligth bulb",
            levelId: "level-1-lexical",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "'ligth bulb' finds no light bulb, although many light listings are in the catalog. The same happens for 'biycicle plant stands' and 'pedistole sink'. Chapters 1 to 3 never rewrite a word; they look the typo up as typed and find nothing useful. Before you press: zero results, or the wrong ones?",
        links: [
          {
            label: "Watch chapter 3 return nothing for 'ligth bulb' →",
            href: "/search?q=ligth%20bulb&level=level-1-lexical&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "Before lookup, rewrite each unknown word to the closest word sellers actually wrote: one edit for words up to 4 letters, two for longer ones, only for words seen in at least two listings, and only when the guess is unique. A word written as one token that is two words, such as 'roomtables', is split. The rewrite is shown above the list, so you can see what ran. A few demo typos are additionally pinned in query understanding, so every chapter guesses them; chapter 4 is the first that looks the corrected word up. A word with two equally close neighbours, or a string far from every word such as 'xqzt', is left alone and still finds nothing.",
        tries: [
          { label: "'ligth' corrected", query: "ligth", levers: ALL_ON },
          { label: "'biycicle' corrected", query: "biycicle", levers: ALL_ON },
          { label: "'pedistole' corrected", query: "pedistole", levers: ALL_ON },
          { label: "'xqzt' left alone", query: "xqzt", levers: ALL_ON },
        ],
      },
      {
        kind: "name",
        text: "This is spelling normalization: edit-distance correction over the corpus vocabulary. Trade-off: a rare but correct word can be rewritten into a common wrong one. The distance limit, the unique-best rule and the established-words-only vocabulary keep that rare.",
        links: [
          {
            label: "Read the correction code →",
            href: "/level/level-1-spelling?file=src/domain/text/spell-correction.ts",
          },
          {
            label: "Compare chapter 3 and chapter 4 on 'ligth' →",
            href: "/compare?q=ligth&left=level-1-lexical&right=level-1-spelling",
          },
        ],
      },
    ],
    codeFocus:
      "match corrects the tokens and runs the chapter 3 lookup on the corrected words. score reuses the chapter 3 score and adds the spellingCorrection flag.",
  },
  {
    levelId: "level-1-entities",
    question: "Name the attributes, not the seller's words",
    steps: [
      {
        kind: "naive",
        text: "Require every word in the listing text, as chapter 4 does.",
        tries: [
          {
            label: "'moen faucet' at chapter 4",
            query: "moen faucet",
            levelId: "level-1-spelling",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "'moen faucet' fills the page with robe hooks and a paper holder that share the words, while the real Moen faucet sits below them at position 13. The buyer named a brand and a type; the words alone do not say which product is which. Tagging turns those words into concepts, so the right kind of product stops losing to the wrong one. Follow the link and guess first: how far down is the real faucet?",
        links: [
          {
            label: "See chapter 4 find almost nothing →",
            href: "/search?q=moen%20faucet&level=level-1-spelling&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "Tag the query words and the listing text with one shared table: colour, material, brand and product type. Every concept must hold, but each may hold in words or in derived fields: a listing whose features say 'color : champagne' satisfies colour CHAMPAGNE. Chapter 4 candidates are kept, attribute-satisfied listings are added, and a structured match counts 1 while a word match counts half. The table is coarse: it also adds a Moen cartridge kit for 'moen faucet', and a bare word with no table entry, such as 'marble', claims no attribute and stays a word search.",
        tries: [
          {
            label: "'moen faucet' with entities",
            query: "moen faucet",
            levers: ALL_ON,
          },
          {
            label: "'kohler kitchen faucet' with entities",
            query: "kohler kitchen faucet",
            levers: ALL_ON,
          },
          {
            label: "'turquoise pillows' with entities",
            query: "turquoise pillows",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "name",
        text: "This is entity-tagged matching: AND over concepts, OR over representations. Trade-off: the tables are hand-written, so a new brand needs a table edit, and an ambiguous word such as 'marble' needs a product type to mean one thing. Open any result to see which concept held structurally and which held in words.",
        links: [
          {
            label: "Read the ontology tables →",
            href: "/level/level-1-entities?file=src/domain/query-understanding/entities.ts",
          },
          {
            label: "Compare chapter 4 and chapter 5 on 'moen faucet' →",
            href: "/compare?q=moen%20faucet&left=level-1-spelling&right=level-1-entities",
          },
        ],
      },
    ],
    codeFocus:
      "match keeps the chapter 4 candidates and adds listings whose attributes satisfy every query concept. score adds the structured and lexical concept signals.",
  },
  {
    levelId: "level-1-canonical",
    question: "Keep the rug, remove the rug pad",
    steps: [
      {
        kind: "naive",
        text: "Require every named attribute, as chapter 5 does.",
        tries: [
          {
            label: "'area rug' at chapter 5",
            query: "area rug",
            levelId: "level-1-entities",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "'area rug' mixes rugs with rug pads: both name the type RUG and both write the word 'rug'. The same happens for 'lamp' (lamp, lamp shade) and 'curtains' (panels, rods). Attribute matching cannot tell a product from its accessory. Before you open it: a rug at rank 1, or a rug pad?",
        links: [
          {
            label: "See chapter 5 mix them →",
            href: "/search?q=area%20rug&level=level-1-entities&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "Give every listing one canonical product family from its listing text, and read the same family from the query with a confidence. The policy filters only when the query is confident: high confidence removes known accessories and wrong sizes, medium confidence only boosts, and listings the mapping cannot read are never removed.",
        tries: [
          { label: "'area rug' with policy", query: "area rug", levers: ALL_ON },
          { label: "'kohler faucet' with policy", query: "kohler faucet", levers: ALL_ON },
        ],
      },
      {
        kind: "name",
        text: "This is a canonical model with search policy: FILTER, BOOST or FEATURE. Trade-off: the tables are hand-written, and there is no gate on the listing side: once the query is confident the policy acts, so a wrong mapping filters good listings.",
        links: [
          {
            label: "Read the mapping tables →",
            href: "/level/level-1-canonical?file=src/domain/canonical/model.ts",
          },
          {
            label: "Compare chapter 5 and this chapter →",
            href: "/compare?q=area%20rug&left=level-1-entities&right=level-1-canonical",
          },
        ],
      },
    ],
    codeFocus:
      "match annotates the corrected query words and removes known mismatches on family, brand and size only under FILTER. score adds productTypeMatch plus attributeMatch.",
  },
  {
    levelId: "level-2-boosting",
    question: "Use what I meant, not only the words I typed",
    steps: [
      {
        kind: "naive",
        text: "Order the candidates by text, attribute and canonical match only, as chapter 6 does.",
        tries: [
          {
            label: "'marble' at chapter 6",
            query: "marble",
            levelId: "level-1-canonical",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "'marble' matches marble end tables and marble floor tile equally well: the word is the same. Text match knows nothing about category, price or how old a listing is. Before you open it: the end table on top, or the tile?",
        links: [
          {
            label: "See chapter 6 rank these without boosts →",
            href: "/search?q=marble&level=level-1-canonical&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "First work out what the query points at. A bare 'marble' defeats the guess and nothing is boosted; add a product word, such as 'marble end table', and the category resolves. Then add points to listings in that category and at a fitting price, plus points that do not depend on the query at all: a recent post, a longer title, and a price that sits high in its category.",
        tries: [{ label: "'marble' at chapter 7", query: "marble", levers: ALL_ON }],
        links: [{ label: "How the category is guessed →", href: "/level/level-2-boosting" }],
      },
      {
        kind: "name",
        text: "Working out what the query points at is query understanding. The added points are boosts. The query-independent part is static quality. Trade-off: every weight is picked by hand, and the next boost starts to fight the last one. WANDS has no price, so the price and its percentile here are a deterministic synthetic overlay column.",
        links: [
          {
            label: "Open a listing to see each weight →",
            href: "/search?q=marble&level=level-2-boosting&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
    ],
    codeFocus:
      "match is passed through unchanged from chapter 6. score takes the chapter 6 score and adds the named boosts to it.",
  },
  {
    levelId: "level-3-learned",
    question: "Let data choose the weights",
    steps: [
      {
        kind: "naive",
        text: "Tune the boost weights by hand: +0.3 for the right category, +0.1 for a fresh post, and so on.",
        tries: [
          {
            label: "'marble' at chapter 7",
            query: "marble",
            levelId: "level-2-boosting",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "Every new weight changes the balance of all the others. After ten boosts nobody can say why a listing sits where it sits, and every change is a guess that must be checked on the scorecard by hand. Before you open it: can you say why the top listing won?",
        links: [
          {
            label: "See chapter 7's hand-picked weights →",
            href: "/search?q=marble&level=level-2-boosting&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "Record which listing searchers clicked. Train a model that learns one weight per feature from those clicks, so that the clicked listing scores above the skipped one. At query time every listing is scored on its own with the learned weights. The score has no unit; only the order matters.",
        tries: [{ label: "'marble' at chapter 8", query: "marble", levers: ALL_ON }],
        links: [
          {
            label: "Open a listing to see each learned weight →",
            href: "/search?q=marble&level=level-3-learned&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "name",
        text: "This is learning to rank with a linear model. It is trained with a pairwise loss: the training rule looks at two listings shown for one query and pushes the model to score the clicked one above the skipped one. The click log was simulated from the WANDS grades, so a listing at rank r was examined with probability 1/r. Raw clicks therefore mostly copy the order they were shown in. The fix weights each click by how likely its position was examined (inverse propensity weighting). After that correction, the learned order should keep chapter 7's wins, without hand-picking the category boost. The scorecard is how you check.",
        links: [
          { label: "Position bias, worked through →", href: "/bias" },
          { label: "The hand-picked boost this replaces →", href: "/level/level-2-boosting" },
        ],
      },
    ],
    codeFocus:
      "score computes the per-item features and multiplies each by its learned weight. Nothing compares two listings at query time; the pairs live in the trainer.",
  },
  {
    levelId: "level-4-hybrid",
    question: "Find the meaning, not only the words",
    steps: [
      {
        kind: "naive",
        text: "Every level so far needs shared words or named attributes: the query and the listing must meet in the ontology or the index.",
        tries: [
          {
            label: "'couch' at chapter 8",
            query: "couch",
            levelId: "level-3-learned",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "'couch' relies on the word or the synonym table. A listing titled 'sectional' or 'loveseat' that never writes 'couch' or 'sofa' is missed. Words, even with attributes, are the wrong unit for meaning. Before you open it: how many near neighbours does 'couch' reach?",
        links: [
          {
            label: "Watch chapter 8 miss the sectional →",
            href: "/search?q=couch&level=level-3-learned&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "A neural network turns each listing into a vector once, ahead of time. At query time the query becomes a vector too, and the listings whose vectors point the same way become candidates, even when no word matches. The word-based list and the vector list are merged by rank, because their scores are on different scales.",
        tries: [{ label: "'couch' at chapter 9", query: "couch", levers: ALL_ON }],
      },
      {
        kind: "name",
        text: "This is hybrid search. The vectors are embeddings, made by an encoder. Two vectors are compared by cosine similarity, and the two lists are merged by reciprocal rank fusion. Trade-off: near neighbours in meaning enter the candidate list too (a table is a candidate for 'couch'), and a second index costs memory and time.",
        tries: [{ label: "More candidates for 'couch'", query: "couch", levers: ALL_ON }],
        links: [
          {
            label: "Compare chapter 8 and chapter 9 on 'couch' →",
            href: "/compare?q=couch&left=level-3-learned&right=level-4-hybrid",
          },
        ],
      },
    ],
    codeFocus:
      "match runs the lexical match and the vector search and unions the two candidate sets. score fuses the two ranks.",
  },
  {
    levelId: "level-5-cross-encoder",
    question: "Read the query and the listing together",
    steps: [
      {
        kind: "naive",
        text: "Chapter 9 turns the query and each listing into vectors separately. The two vectors never see each other's words.",
        tries: [
          {
            label: "'table lamp' at chapter 9",
            query: "table lamp",
            levelId: "level-4-hybrid",
            levers: ALL_ON,
          },
        ],
      },
      {
        kind: "problem",
        text: "A table lamp and a lamp shade share words and have similar vectors. Merging their ranks does not check the two texts together. It can put a shade above a useful lamp. Before you open it: the lamp first, or the shade?",
        links: [
          {
            label: "See chapter 9 encode each text on its own →",
            href: "/search?q=table%20lamp&level=level-4-hybrid&stemming=1&synonyms=1&variants=1",
          },
        ],
      },
      {
        kind: "solution",
        text: "Take chapter 9's first 50 candidates. Feed the query and each listing into a pretrained neural network together. Its attention layers can compare words across both texts before producing a relevance score. Sort the short list by that score.",
        tries: [{ label: "Rerank 'table lamp'", query: "table lamp", levers: ALL_ON }],
        links: [
          {
            label: "Compare the same query before and after →",
            href: "/compare?q=table%20lamp&left=level-4-hybrid&right=level-5-cross-encoder",
          },
        ],
      },
      {
        kind: "name",
        text: "This is cross-encoder reranking. The model was trained on MS MARCO search pairs, not this app's judgments or clicks. It adds inference time for every pair, and it cannot recover a listing outside the first 50, so Recall@50 stays the same as chapter 9. Check NDCG@10, MRR and the query regressions to judge whether the new order is better.",
        links: [{ label: "Check quality and cost for every chapter →", href: "/scorecard" }],
      },
    ],
    codeFocus:
      "match takes chapter 9's first 50 and awaits one batch of joint scores. score returns each stored model score and the earlier rank for comparison.",
  },
  {
    levelId: "level-6-two-tower",
    question: "Teach the vectors what this catalog means",
    steps: [
      {
        kind: "naive",
        text: "Chapter 10 reads each query and listing together, but only for the first 50 candidates from chapter 9. Keep that useful ranking stage. Now ask whether its shortlist left out something useful.",
        tries: [
          {
            label: "Start with chapter 10",
            query: "area rug",
            levelId: "level-5-cross-encoder",
            levers: ALL_ON,
          },
        ],
        links: [
          {
            label: "Why chapter 10 cannot precompute →",
            href: "/search?level=level-5-cross-encoder",
          },
        ],
      },
      {
        kind: "problem",
        text: "A perfect reranker still cannot recover a missing candidate. General-purpose vectors also read long, sometimes off-topic listing descriptions. The first click-trained attempt used unreliable negatives and optimized a different target from the relevance grades. We need better supervision and better item inputs. Before running the fix below, guess: does chapter 10 already find the right 'area rug' candidates?",
        links: [
          { label: "See the chapter 9 encoder in the code →", href: "/level/level-4-hybrid" },
        ],
      },
      {
        kind: "solution",
        text: "Train separate query and item heads on graded preferences from training query groups. Keep title information prominent in item vectors. Retrieve new neighbours and reuse chapter 10's joint scores. Validation selects the candidate budget and a global weight for adding trained similarity to joint relevance. Open a result to see the two weighted terms.",
        tries: [{ label: "Run trained retrieval", query: "area rug", levers: ALL_ON }],
        links: [
          {
            label: "Compare the actual candidate sets →",
            href: "/compare?q=area%20rug&left=level-5-cross-encoder&right=level-6-two-tower",
          },
        ],
      },
      {
        kind: "name",
        text: "This is supervised two-tower retrieval with validation-selected score fusion. The item side stays precomputable; both heads train while the transformer stays frozen. Test query groups are excluded from training and selection. Inspect their scorecard as well as the overall average. The optional “Go deeper” panel below the results shows why the first approach failed, how the loss works, and what the actual scores mean.",
        links: [
          {
            label: "Open the optional Go deeper panel →",
            href: "#two-tower-lab",
          },
          {
            label: "Evaluate held-out queries →",
            href: "/scorecard?split=test&level=level-6-two-tower",
          },
          {
            label: "Read the projection that serves each query →",
            href: "/level/level-6-two-tower?file=src/domain/two-tower/projection.ts",
          },
        ],
      },
    ],
    codeFocus:
      "match awaits chapter 10, retrieves trained neighbours and scores only new pairs. combineTowerScores adds the validation-weighted similarity. Open projectVector to follow the learned query head.",
  },
];

export function lessonFor(levelId: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.levelId === levelId);
}

export const STEP_TITLES: Record<LessonStep["kind"], string> = {
  naive: "Start simple",
  problem: "Where it breaks",
  solution: "The fix",
  name: "What it is called",
};
