import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import type { QueryUnderstanding } from "../types/query.ts";
import { buildSignals } from "./build-signals.ts";

function item(id: string, title: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "sports",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
  };
}

const understanding: QueryUnderstanding = {
  rawText: "lamp",
  tokens: ["lamp"],
  normalizedTokens: ["lamp"],
  expandedTokens: ["lamp"],
  predictedCategoryId: null,
  priceConstraint: null,
  spellingCorrection: [],
  queryVector: null,
};

describe("per-candidate signals", () => {
  it("Given two candidates, When signals are assembled for one candidate, Then no signal is computed from the other candidate", () => {
    const left = item("lamp-1", "Red lamp");
    const right = item("sofa-1", "Blue sofa");
    const signals = buildSignals(understanding, left, [{ name: "bm25", value: 1.25 }]);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.explanation).toContain("Red lamp");
    expect(signals[0]?.explanation).not.toContain("lamp-1");
    expect(signals[0]?.explanation).not.toContain(right.id);
    expect(signals[0]?.explanation).not.toContain(right.title);
  });
});
