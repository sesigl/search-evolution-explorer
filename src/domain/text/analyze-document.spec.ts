import { describe, expect, it } from "vitest";
import { analyzeDocument } from "./analyze-document.ts";
import { stem } from "./stem.ts";

const levers = {
  stopWords: [] as string[],
  synonymGroups: [] as string[][],
  variantRules: [],
};

describe("document analysis", () => {
  it("Given a token that stems to itself, When the document is analyzed, Then the term is stored once", () => {
    expect(analyzeDocument("run", levers)).toEqual(["run"]);
  });

  it("Given a token that stems to a different form, When the document is analyzed, Then both the surface form and the stem are stored", () => {
    expect(analyzeDocument("running", levers)).toEqual(["running", stem("running")]);
  });
});
