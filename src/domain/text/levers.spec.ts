import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import { createRanker } from "../levels/level-1-normalization.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration, LeverOverrides } from "../types/query.ts";
import { analyzeDocument } from "./analyze-document.ts";
import { understandQuery } from "./analyze-query.ts";

const levers: LeverConfiguration = {
  stopWords: ["a", "an", "the"],
  synonymGroups: [
    ["sofa", "couch"],
    ["bike", "bicycle"],
  ],
  variantRules: [
    { pattern: "e bike", canonical: "ebike" },
    { pattern: "electric bike", canonical: "ebike" },
  ],
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
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
  };
}

function matchedIds(
  items: readonly CorpusItem[],
  queryText: string,
  overrides: LeverOverrides,
): string[] {
  const corpus: CorpusSource = {
    readItems: async () => items,
    readCategories: async () => [],
  };
  const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
  const ranker = createRanker({ corpus, index, levers, clock });
  const understanding = understandQuery(queryText, levers, overrides);
  return ranker
    .match(understanding)
    .items.map((entry) => entry.id)
    .sort();
}

describe("recall levers", () => {
  it("Given a plural query and a singular listing, When stemming is on, Then the listing is retrieved, and When stemming is off, Then it is missed", () => {
    const items = [item("sofa", "Blue sofa")];
    expect(
      matchedIds(items, "sofas", { stemming: true, synonyms: false, variants: false }),
    ).toEqual(["sofa"]);
    expect(
      matchedIds(items, "sofas", { stemming: false, synonyms: false, variants: false }),
    ).toEqual([]);
  });

  it("Given a listing that only shares a stem, When stemming is on, Then a false positive is retrieved", () => {
    const items = [item("list", "A short list")];
    expect(
      matchedIds(items, "listing", { stemming: true, synonyms: false, variants: false }),
    ).toEqual(["list"]);
    expect(
      matchedIds(items, "listing", { stemming: false, synonyms: false, variants: false }),
    ).toEqual([]);
  });

  it("Given a sofa listing, When the query is couch and synonyms are on, Then the listing is retrieved, and When synonyms are off, Then it is missed", () => {
    const items = [item("sofa", "Blue sofa")];
    expect(
      matchedIds(items, "couch", { stemming: false, synonyms: true, variants: false }),
    ).toEqual(["sofa"]);
    expect(
      matchedIds(items, "couch", { stemming: false, synonyms: false, variants: false }),
    ).toEqual([]);
  });

  it("Given a bicycle listing, When the query is bike and synonyms are on, Then a false positive is retrieved", () => {
    const items = [item("bicycle", "Folding bicycle")];
    expect(matchedIds(items, "bike", { stemming: true, synonyms: true, variants: false })).toEqual([
      "bicycle",
    ]);
    expect(matchedIds(items, "bike", { stemming: true, synonyms: false, variants: false })).toEqual(
      [],
    );
  });

  it("Given an e-bike listing, When variants are on, Then the listing is retrieved, and When variants are off, Then it is missed", () => {
    const items = [item("ebike", "City e-bike")];
    expect(
      matchedIds(items, "e-bike", { stemming: false, synonyms: false, variants: true }),
    ).toEqual(["ebike"]);
    expect(
      matchedIds(items, "e-bike", { stemming: false, synonyms: false, variants: false }),
    ).toEqual([]);
  });

  it("Given an electric-bike listing, When the query is e-bike and variants are on, Then a false positive is retrieved", () => {
    const items = [item("electric", "Folding electric bike")];
    expect(
      matchedIds(items, "e-bike", { stemming: false, synonyms: false, variants: true }),
    ).toEqual(["electric"]);
    expect(
      matchedIds(items, "e-bike", { stemming: false, synonyms: false, variants: false }),
    ).toEqual([]);
  });
});
