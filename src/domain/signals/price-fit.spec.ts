import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { priceFitScore } from "./price-fit.ts";

function item(priceCents: number): CorpusItem {
  return {
    id: "lamp",
    title: "lamp",
    description: "",
    categoryId: "electronics",
    priceCents,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function understanding(priceConstraint: QueryUnderstanding["priceConstraint"]): QueryUnderstanding {
  return {
    rawText: "lamp",
    tokens: ["lamp"],
    normalizedTokens: ["lamp"],
    expandedTokens: ["lamp"],
    predictedCategoryId: null,
    priceConstraint,
    spellingCorrection: [],
    queryVector: null,
  };
}

describe("price-fit score", () => {
  it("Given no price constraint, When price-fit is scored, Then the value is 0", () => {
    expect(priceFitScore(understanding(null), item(1000))).toBe(0);
  });

  it("Given a maximum price, When the listing is over budget, Then price-fit is 0", () => {
    expect(priceFitScore(understanding({ maxCents: 5000 }), item(80_000))).toBe(0);
  });

  it("Given a maximum price, When the listing is at the bound, Then price-fit is 1", () => {
    expect(priceFitScore(understanding({ maxCents: 5000 }), item(5000))).toBe(1);
  });

  it("Given a minimum price, When the listing is cheaper, Then price-fit is 0", () => {
    expect(priceFitScore(understanding({ minCents: 5000 }), item(1000))).toBe(0);
  });

  it("Given a minimum price, When the listing meets the bound, Then price-fit is 1", () => {
    expect(priceFitScore(understanding({ minCents: 1000 }), item(1000))).toBe(1);
  });
});
