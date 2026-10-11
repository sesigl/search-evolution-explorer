import { describe, expect, it } from "vitest";
import type { LeverConfiguration } from "../types/query.ts";
import { queryTextForEncoding, understand, understandingForMatching } from "./understand.ts";

const levers: LeverConfiguration = {
  stopWords: ["a", "the"],
  synonymGroups: [["sofa", "couch"]],
  variantRules: [],
};

describe("query understanding", () => {
  it("Given a furniture term, When the query is understood, Then Furniture is predicted", () => {
    expect(understand("leather chairs", levers, {}, []).predictedCategoryId).toBe("Furniture");
    expect(understand("chair", levers, {}, []).predictedCategoryId).toBe("Furniture");
  });

  it("Given a plural category term, When the query is understood, Then Rugs is predicted", () => {
    expect(understand("rugs", levers, {}, []).predictedCategoryId).toBe("Rugs");
  });

  it("Given a lighting term, When the query is understood, Then Lighting is predicted", () => {
    expect(understand("chandelier", levers, {}, []).predictedCategoryId).toBe("Lighting");
  });

  it("Given a known typo, When the query is understood, Then the corrected category is predicted", () => {
    expect(understand("ligth bulb", levers, {}, []).predictedCategoryId).toBe("Lighting");
  });

  it("Given tokens that hit two categories equally, When the query is understood, Then no category is predicted", () => {
    expect(understand("wall rack", levers, {}, []).predictedCategoryId).toBeNull();
  });

  it("Given a query with an upper price bound, When the query is understood, Then a price constraint is extracted", () => {
    const understanding = understand("lamp under 50", levers, {}, []);
    expect(understanding.priceConstraint).toEqual({ maxCents: 5000 });
    expect(understanding.predictedCategoryId).toBe("Lighting");
  });

  it("Given a price constraint, When tokens are prepared for matching, Then bound words are dropped", () => {
    const understanding = understand("lamp under 50", levers, { stemming: false }, []);
    expect(understandingForMatching(understanding).normalizedTokens).toEqual(["lamp"]);
  });

  it("Given a known typo, When the query is understood, Then a spelling correction is recorded", () => {
    expect(understand("ligth", levers, {}, []).spellingCorrection).toEqual([
      { from: "ligth", to: "light" },
    ]);
  });

  it("Given a known typo, When the query is prepared for encoding, Then the corrected text is used", () => {
    expect(queryTextForEncoding("ligth bulb")).toBe("light bulb");
  });
});
