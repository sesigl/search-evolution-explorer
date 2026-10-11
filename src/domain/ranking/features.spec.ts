import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import { understand } from "../query-understanding/understand.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration, QueryUnderstanding } from "../types/query.ts";
import { extractFeatures, FEATURE_NAMES } from "./features.ts";

const levers: LeverConfiguration = {
  stopWords: [],
  synonymGroups: [],
  variantRules: [],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(id: string, title: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "Furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

describe("feature extraction", () => {
  it("Given two candidates, When features are extracted, Then each vector is a function of one query-item pair and does not change when the other candidate is present", () => {
    const a = item("a", "Blue sofa");
    const b = item("b", "Red chair");
    const together = buildInvertedIndex([a, b], (text) => analyzeDocument(text, levers));
    const alone = buildInvertedIndex([a], (text) => analyzeDocument(text, levers));
    const understanding = understand("sofa", levers, {}, []);
    const withNeighbour = extractFeatures(understanding, a, { index: together, levers, clock });
    const withoutNeighbour = extractFeatures(understanding, a, { index: alone, levers, clock });
    expect(FEATURE_NAMES).toHaveLength(withNeighbour.length);
    expect(withNeighbour[5]).toBe(withoutNeighbour[5]);
    expect(withNeighbour[1]).toBe(withoutNeighbour[1]);
    expect(withNeighbour[3]).toBe(withoutNeighbour[3]);
    expect(withNeighbour[4]).toBe(withoutNeighbour[4]);
  });

  it("Given a matching listing, When features are extracted, Then the bm25 feature stays in unit range so recency can compete", () => {
    const listing = item("a", "Blue sofa");
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    const features = extractFeatures(understand("sofa", levers, {}, []), listing, {
      index,
      levers,
      clock,
    });
    expect(features[0]).toBeGreaterThan(0);
    expect(features[0] ?? 0).toBeLessThanOrEqual(1);
  });

  it("Given a price constraint, When features are extracted, Then an over-budget listing gets a zero price-fit feature", () => {
    const cheap = item("cheap", "lamp");
    const dear = { ...item("dear", "lamp"), priceCents: 80_000 };
    const index = buildInvertedIndex([cheap, dear], (text) => analyzeDocument(text, levers));
    const understanding = understand("lamp under 50", levers, {}, []);
    const inBudget = extractFeatures(understanding, cheap, { index, levers, clock });
    const overBudget = extractFeatures(understanding, dear, { index, levers, clock });
    expect(inBudget[2]).toBe(1);
    expect(overBudget[2]).toBe(0);
  });

  it("Given a price equal to the maximum, When features are extracted, Then price-fit is 1", () => {
    const listing = { ...item("cap", "lamp"), priceCents: 5000 };
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    const understanding = understand("lamp under 50", levers, {}, []);
    expect(extractFeatures(understanding, listing, { index, levers, clock })[2]).toBe(1);
  });

  it("Given a minimum price constraint, When features are extracted, Then a cheaper listing gets zero price-fit", () => {
    const cheap = item("cheap", "lamp");
    const dear = { ...item("dear", "lamp"), priceCents: 8000 };
    const index = buildInvertedIndex([cheap, dear], (text) => analyzeDocument(text, levers));
    const understanding = withUnderstanding({ priceConstraint: { minCents: 5000 } });
    expect(extractFeatures(understanding, cheap, { index, levers, clock })[2]).toBe(0);
    expect(extractFeatures(understanding, dear, { index, levers, clock })[2]).toBe(1);
    expect(
      extractFeatures(withUnderstanding({ priceConstraint: { minCents: 1000 } }), cheap, {
        index,
        levers,
        clock,
      })[2],
    ).toBe(1);
  });

  it("Given no price constraint, When features are extracted, Then price-fit is 0", () => {
    const listing = item("a", "lamp");
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    const understanding = understand("lamp", levers, {}, []);
    expect(extractFeatures(understanding, listing, { index, levers, clock })[2]).toBe(0);
  });

  it("Given a title of 20 characters, When features are extracted, Then title quality is 0.5 and longer titles cap at 1", () => {
    const shortTitle = "a".repeat(20);
    const exactTitle = "a".repeat(40);
    const longTitle = "a".repeat(80);
    const shortItem = item("short", shortTitle);
    const exactItem = item("exact", exactTitle);
    const longItem = item("long", longTitle);
    const index = buildInvertedIndex([shortItem, exactItem, longItem], (text) =>
      analyzeDocument(text, levers),
    );
    expect(
      extractFeatures(understand(shortTitle, levers, {}, []), shortItem, {
        index,
        levers,
        clock,
      })[4],
    ).toBe(0.5);
    expect(
      extractFeatures(understand(exactTitle, levers, {}, []), exactItem, {
        index,
        levers,
        clock,
      })[4],
    ).toBe(1);
    expect(
      extractFeatures(understand(longTitle, levers, {}, []), longItem, { index, levers, clock })[4],
    ).toBe(1);
  });

  it("Given a furniture query, When features are extracted, Then category-match is 1 for a furniture listing and 0 otherwise", () => {
    const sofa = item("sofa", "Blue sofa");
    const other = { ...item("other", "Blue sofa"), categoryId: "Rugs" };
    const index = buildInvertedIndex([sofa, other], (text) => analyzeDocument(text, levers));
    const understanding = understand("sofa", levers, {}, []);
    expect(extractFeatures(understanding, sofa, { index, levers, clock })[1]).toBe(1);
    expect(extractFeatures(understanding, other, { index, levers, clock })[1]).toBe(0);
  });

  it("Given overlapping tokens, When features are extracted, Then term-overlap is the hit ratio", () => {
    const listing = item("a", "red lamp");
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    expect(
      extractFeatures(understand("lamp", levers, {}, []), listing, { index, levers, clock })[5],
    ).toBe(1);
    expect(
      extractFeatures(understand("red sofa", levers, {}, []), listing, { index, levers, clock })[5],
    ).toBe(0.5);
    expect(
      extractFeatures(withUnderstanding({ tokens: [] }), listing, { index, levers, clock })[5],
    ).toBe(0);
  });
});

function withUnderstanding(overrides: Partial<QueryUnderstanding>): QueryUnderstanding {
  return {
    rawText: "lamp",
    tokens: ["lamp"],
    normalizedTokens: ["lamp"],
    expandedTokens: ["lamp"],
    predictedCategoryId: null,
    priceConstraint: null,
    spellingCorrection: [],
    queryVector: null,
    ...overrides,
  };
}
