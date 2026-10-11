import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import { annotateQuery } from "./annotate.ts";
import { attributeMatch, keepCandidate } from "./match.ts";

function item(overrides: Partial<CorpusItem>): CorpusItem {
  return {
    id: "x",
    title: "",
    description: "",
    categoryId: "Furniture",
    priceCents: 100,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
    ...overrides,
  };
}

const rug = () => item({ title: "Wool area rug" });
const rugPad = () => item({ title: "Non slip rug pad" });
const mystery = () => item({ title: "Mystery decor object" });
const kohlerFaucet = () => item({ title: "Kohler kitchen faucet" });
const moenFaucet = () => item({ title: "Moen kitchen faucet" });
const queenMattress = () => item({ title: "Queen mattress" });
const kingMattress = () => item({ title: "King mattress" });

describe("canonical keep rules", () => {
  it("keeps matching family members and removes known accessories", () => {
    const annotation = annotateQuery("area rug");
    expect(keepCandidate(annotation, rug())).toBe(true);
    expect(keepCandidate(annotation, rugPad())).toBe(false);
  });
  it("never removes UNKNOWN listings", () => {
    expect(keepCandidate(annotateQuery("area rug"), mystery())).toBe(true);
  });
  it("uses brand when both sides name one", () => {
    expect(keepCandidate(annotateQuery("kohler faucet"), kohlerFaucet())).toBe(true);
    expect(keepCandidate(annotateQuery("kohler faucet"), moenFaucet())).toBe(false);
  });
  it("uses the size model when both sides name one", () => {
    expect(keepCandidate(annotateQuery("queen mattress"), queenMattress())).toBe(true);
    expect(keepCandidate(annotateQuery("queen mattress"), kingMattress())).toBe(false);
  });
});

describe("canonical score support", () => {
  it("scores type plus agreeing details", () => {
    expect(attributeMatch(annotateQuery("queen mattress"), queenMattress())).toEqual({
      productTypeMatch: 1,
      attributeMatch: 1,
    });
    expect(attributeMatch(annotateQuery("queen mattress"), kingMattress())).toEqual({
      productTypeMatch: 1,
      attributeMatch: 0,
    });
    expect(attributeMatch(annotateQuery("area rug"), rugPad())).toEqual({
      productTypeMatch: 0,
      attributeMatch: 0,
    });
  });
});
