import { describe, expect, it } from "vitest";
import { familyOf, QUERY_FAMILIES } from "./query-family.ts";

const WORD_VARIATION_QUERIES = [
  "sofa",
  "couch",
  "loveseat",
  "rug",
  "carpet",
  "mid century",
  "midcentury",
];

const CATEGORY_QUERIES = ["marble", "industrial", "lamp", "curtains", "area rug"];

const MEANING_QUERIES = [
  "ligth bulb",
  "biycicle plant stands",
  "pedistole sink",
  "foutains with brick look",
];

describe("query family", () => {
  it("lists every family with its label and reason", () => {
    expect(QUERY_FAMILIES).toEqual([
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
    ]);
  });

  it.each(MEANING_QUERIES)("classifies %s as a meaning trap", (query) => {
    expect(familyOf(query)).toBe("meaning");
  });

  it.each(CATEGORY_QUERIES)("classifies %s as a category trap", (query) => {
    expect(familyOf(query)).toBe("category");
  });

  it.each(WORD_VARIATION_QUERIES)("classifies %s as a word-variation trap", (query) => {
    expect(familyOf(query)).toBe("word-variation");
  });

  it("classifies a price-bounded query as a price trap", () => {
    expect(familyOf("lamp under 50")).toBe("price");
    expect(familyOf("under 5")).toBe("price");
  });

  it("allows extra space between the price word and the amount", () => {
    expect(familyOf("lamp  under  50")).toBe("price");
  });

  it("requires a word boundary before the price word", () => {
    expect(familyOf("xunder 50")).toBe("typical");
  });

  it("requires a space between the price word and the amount", () => {
    expect(familyOf("under50")).toBe("typical");
  });

  it("requires the price word to be followed by an amount", () => {
    expect(familyOf("under abc")).toBe("typical");
    expect(familyOf("under")).toBe("typical");
  });

  it("classifies a query with no hard case as typical", () => {
    expect(familyOf("coffee table")).toBe("typical");
  });

  it("normalises case and surrounding space before classifying", () => {
    expect(familyOf("  MARBLE  ")).toBe("category");
  });
});
