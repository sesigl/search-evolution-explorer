export type QueryFamilyId = "word-variation" | "category" | "meaning" | "price" | "typical";

export interface QueryFamily {
  readonly id: QueryFamilyId;
  readonly label: string;
  readonly why: string;
}

export const QUERY_FAMILIES: readonly QueryFamily[] = [
  {
    id: "meaning",
    label: "Typos and paraphrases",
    why: "Chapters 1 to 3 cannot match these words. Chapter 4 corrects spelling and chapter 5 matches attributes; a paraphrase with no shared words still needs chapter 9's vectors.",
  },
  {
    id: "category",
    label: "Ambiguous category",
    why: "The same word sits on the product and on an accessory, or in two categories. Chapter 7's category boost should lift the intended listing.",
  },
  {
    id: "price",
    label: "Price constraint",
    why: "The query names a budget. Chapter 7's price-fit boost is what should lift listings that fit.",
  },
  {
    id: "word-variation",
    label: "Word variation",
    why: "The buyer and the seller used different forms of the same word. Chapter 2's switches (stemming, synonyms, variants) are what recover these.",
  },
  {
    id: "typical",
    label: "Typical queries",
    why: "Short catalog queries with no hard case. Later chapters should not make these much worse.",
  },
];

/** Queries whose words need a chapter 2 switch to meet the seller's words. */
const WORD_VARIATION = new Set([
  "sofa",
  "couch",
  "loveseat",
  "rug",
  "carpet",
  "mid century",
  "midcentury",
]);

/** Words that sit on a product and on an accessory, or in two categories. */
const CATEGORY = new Set(["marble", "industrial", "lamp", "curtains", "area rug"]);

/** Real WANDS typos and paraphrases the early chapters cannot match. */
const MEANING = new Set([
  "ligth bulb",
  "biycicle plant stands",
  "pedistole sink",
  "foutains with brick look",
]);

const PRICE = /\bunder\s+\d+/;

export function familyOf(queryText: string): QueryFamilyId {
  const query = queryText.toLowerCase().trim();
  if (MEANING.has(query)) {
    return "meaning";
  }
  if (CATEGORY.has(query)) {
    return "category";
  }
  if (PRICE.test(query)) {
    return "price";
  }
  if (WORD_VARIATION.has(query)) {
    return "word-variation";
  }
  return "typical";
}
