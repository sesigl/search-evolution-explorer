import type { WorkbenchLevers, WorkbenchState } from "../../actions/search-workbench.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageLabel(postedAt: string, nowMs: number): string {
  const posted = Date.parse(postedAt);
  if (Number.isNaN(posted)) {
    return "unknown age";
  }
  const days = Math.floor((nowMs - posted) / DAY_MS);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

export function priceLabel(priceCents: number): string {
  return `EUR ${(priceCents / 100).toFixed(2)}`;
}

export function scoreText(score: number): string {
  return Math.abs(score) < 0.1 ? score.toFixed(4) : score.toFixed(3);
}

/**
 * Score vocabulary keyed on the level id, never on the ordinal. Ordinals move whenever a
 * chapter is inserted, and every ordinal-keyed label then describes the chapter above it.
 */
const SCORE_LABELS: Record<string, string> = {
  "level-1-recency": "Newest first (recency)",
  "level-1-normalization": "Newest first (normalized match)",
  "level-1-lexical": "Text match (BM25)",
  "level-1-spelling": "Corrected text match (BM25)",
  "level-1-entities": "Text + entity match (BM25)",
  "level-1-canonical": "BM25 + policy",
  "level-2-boosting": "BM25 + boosts",
  "level-3-learned": "Learned score",
  "level-4-hybrid": "Fused rank (RRF)",
  "level-5-cross-encoder": "Joint relevance",
  "level-6-two-tower": "Joint + trained",
};

interface SignalInfo {
  readonly label: string;
  readonly meaning: string;
}

const SIGNALS: Record<string, SignalInfo> = {
  candidateCompetition: {
    label: "Other candidates",
    meaning:
      "This listing's joint score is unchanged. Its position changed because the surrounding candidate ranking changed.",
  },
  twoTowerSimilarity: {
    label: "Trained similarity",
    meaning:
      "Dot product of separately trained unit query/item vectors. It retrieves candidates and enters the final score with the displayed validation-selected weight. It is not an engagement probability.",
  },
  twoTowerRank: {
    label: "Trained retrieval rank",
    meaning:
      "Position in the independent trained-vector retrieval list. The validation-selected budget limits which new candidates enter. The rank itself is not added to the final score.",
  },
  learnedRetrievalOnly: {
    label: "New candidate",
    meaning:
      "1 means learned retrieval found this listing outside chapter 10's first 50. The shared cross-encoder then scored it. Absence of this signal means chapter 10 already retrieved it.",
  },
  crossEncoder: {
    label: "Joint relevance",
    meaning:
      "The pretrained cross-encoder reads the query and listing together. This raw model score can be negative. Higher means a better match; it is not a probability or a sum of the other signals.",
  },
  previousRank: {
    label: "Chapter 9 rank",
    meaning:
      "Position in chapter 9's ranking before reranking. Only its first 50 listings are rescored. This position is shown for comparison and does not enter the new score.",
  },
  bm25: {
    label: "Text match (BM25)",
    meaning:
      "How strongly the listing text matches the query words. A word that is unusual across all listings, but repeated in this one, counts most.",
  },
  spellingCorrection: {
    label: "Spelling correction",
    meaning:
      "1 means the chapter corrected a query word against the listing vocabulary before lookup; 0 means the words were used as typed. The flag itself adds no points.",
  },
  structuredConceptMatch: {
    label: "Structured attribute match",
    meaning:
      "How many of the query's named attributes (brand, model, color, city, storage, product type) the listing's derived attributes satisfy. Counts 1 per concept.",
  },
  lexicalConceptMatch: {
    label: "Word attribute match",
    meaning:
      "How many of the query's named attributes appear as words in the listing text. Counts 1 per concept, with a smaller weight than the structured match.",
  },
  termOverlap: {
    label: "Words found",
    meaning: "Share of the query words that appear in the listing. 1 means all of them.",
  },
  categoryMatch: {
    label: "Category match",
    meaning: "1 when the listing is in the category guessed from the query, else 0.",
  },
  priceFit: {
    label: "Price fit",
    meaning: "How well the price fits a price named in the query. 0 when the query names no price.",
  },
  recency: {
    label: "Recency",
    meaning: "Newer listings score higher. Does not depend on the query.",
  },
  titleQuality: {
    label: "Title length prior",
    meaning:
      "Rewards a longer, more descriptive title up to a fixed length. It is a length prior, not a judgement of quality, and it does not depend on the query.",
  },
  pricePercentile: {
    label: "Price position",
    meaning: "Where the price sits among listings of the same category.",
  },
  learnedScore: {
    label: "Learned score",
    meaning:
      "Each feature listed below times its learned weight, summed. The model also adds a fixed intercept to every listing; it is left out here because it shifts all scores by the same amount and never changes the order. Only the order matters.",
  },
  rrf: {
    label: "Fused rank (RRF)",
    meaning:
      "1 / (60 + rank in the word-match list) plus 1 / (60 + rank in the vector list). Ranks are merged because the two raw scores are on different scales. The 60 is a smoothing constant from the original paper: it keeps the gap between rank 1 and rank 2 small, so one list cannot outvote the other with a single top hit.",
  },
  vectorSimilarity: {
    label: "Meaning similarity",
    meaning:
      "Cosine similarity between the query vector and the listing vector. 1 means the same meaning, 0 means unrelated.",
  },
};

export function signalInfo(name: string): SignalInfo {
  return SIGNALS[name] ?? { label: name, meaning: "" };
}

export const GRADE_LABELS: Record<number, string> = {
  3: "exactly it",
  2: "good",
  1: "partly",
  0: "not relevant",
};

export function scoreLabelFor(levelId: string | undefined): string {
  return SCORE_LABELS[levelId ?? ""] ?? "Score";
}

const SCORE_SIGNALS: Record<string, string> = {
  "level-1-recency": "recency",
  "level-1-normalization": "recency",
  "level-1-lexical": "bm25",
  "level-1-spelling": "bm25",
  "level-1-entities": "bm25",
  "level-1-canonical": "bm25",
  "level-2-boosting": "bm25",
  "level-3-learned": "learnedScore",
  "level-4-hybrid": "rrf",
  "level-5-cross-encoder": "crossEncoder",
  "level-6-two-tower": "crossEncoder",
};

/** One sentence on what the score of this level means, shown where the score is labelled. */
export function scoreMeaningFor(levelId: string | undefined): string {
  if (levelId === "level-6-two-tower") {
    return "Joint relevance + trained similarity × its validation-selected weight. Both components and the exact sum are shown below each listing.";
  }
  if (levelId === "level-2-boosting") {
    return "The chapter 6 match plus hand-picked boosts for category, price, recency and title quality. Open a listing to see each part.";
  }
  if (levelId === "level-1-canonical") {
    return "The chapter 5 match plus the canonical policy: a confident product type filters known mismatches, and matching type, brand and model add points. Open a listing to see each part.";
  }
  if (levelId === "level-1-spelling") {
    return "The chapter 3 text match on the corrected words. The correction above the list shows what was rewritten before lookup.";
  }
  if (levelId === "level-1-entities") {
    return "The chapter 4 text match plus points for named attributes: structured matches count 1, word matches count half. Open a listing to see each part.";
  }
  return signalInfo(SCORE_SIGNALS[levelId ?? ""] ?? "").meaning;
}

/** Where the weights of a score come from. Null when the chapter's score is not a weighted sum. */
export function weightSourceFor(levelId: string | undefined): string | null {
  if (levelId === "level-6-two-tower") {
    return "The tower parameters use training-query judgments. A fixed validation grid selects the global score weight and retrieval budget. Test-query labels are excluded from both steps.";
  }
  if (levelId === "level-2-boosting") {
    return "The weight of each signal is hand-picked in chapter 7.";
  }
  if (levelId === "level-3-learned") {
    return "The weight of each feature is learned from chapter 7's clicks in chapter 8.";
  }
  return null;
}

/**
 * True when the final score comes from reading the query and the listing together, so every
 * earlier retrieval signal is context only. Those chapters are the cross-encoder and the
 * two-tower retriever.
 */
export function jointRerankingFor(levelId: string | undefined): boolean {
  return levelId === "level-5-cross-encoder" || levelId === "level-6-two-tower";
}

export function workbenchQuery(
  query: string,
  levelId: string,
  levers: WorkbenchLevers,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query !== "") {
    params.set("q", query);
  }
  params.set("level", levelId);
  // Chapter 1 matches words exactly as typed; naming levers in its URL only adds noise.
  if (levelId !== "level-1-recency") {
    if (levers.stemming) {
      params.set("stemming", "1");
    }
    if (levers.synonyms) {
      params.set("synonyms", "1");
    }
    if (levers.variants) {
      params.set("variants", "1");
    }
    if (!(levers.stemming || levers.synonyms || levers.variants)) {
      params.set("levers", "none");
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  return params;
}

export function searchHref(state: Pick<WorkbenchState, "query" | "levelId" | "levers">): string {
  return `/search?${workbenchQuery(state.query, state.levelId, state.levers, 1).toString()}`;
}
