import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import {
  conceptDetail,
  conceptSupport,
  extractItemConcepts,
  extractQueryConcepts,
  retokenize,
  satisfiesConcepts,
} from "./entities.ts";
import { understand } from "./understand.ts";

const levers: LeverConfiguration = { stopWords: [], synonymGroups: [], variantRules: [] };

function item(title: string): CorpusItem {
  return {
    id: title,
    title,
    description: "",
    categoryId: "Furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function queryConcepts(text: string) {
  return extractQueryConcepts(understand(text, levers, {}, []));
}

function keys(text: string): string[] {
  return queryConcepts(text).map((concept) => `${concept.type}:${concept.value}`);
}

function naturalOrder(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

describe("entity concepts", () => {
  it("Given an attribute query, When concepts are read, Then colour and product type are required", () => {
    expect(keys("turquoise pillows").sort(naturalOrder)).toEqual([
      "color:TURQUOISE",
      "productType:PILLOW",
    ]);
  });

  it("Given a material query, When concepts are read, Then colour, material and type are required", () => {
    expect(keys("black leather chair").sort(naturalOrder)).toEqual([
      "color:BLACK",
      "material:LEATHER",
      "productType:CHAIR",
    ]);
  });

  it("Given a synonym, When concepts are read, Then both wordings name one product type", () => {
    expect(keys("couch").sort(naturalOrder)).toEqual(["productType:SOFA"]);
    expect(keys("sofa").sort(naturalOrder)).toEqual(["productType:SOFA"]);
  });

  it("Given a brand, When concepts are read, Then the brand is claimed", () => {
    expect(keys("kohler").sort(naturalOrder)).toEqual(["brand:KOHLER"]);
  });

  it("Given spelling fixes, When tokens are retagged, Then the corrected words are used", () => {
    expect(retokenize(["ligth", "bulb"], [{ from: "ligth", to: "light" }])).toEqual([
      "light",
      "bulb",
    ]);
    expect(retokenize(["couchcase"], [{ from: "couchcase", to: "couch case" }])).toEqual([
      "couch",
      "case",
    ]);
    expect(retokenize(["table"], [])).toEqual(["table"]);
  });

  it("Given a match, When detail is read, Then each deciding concept is named", () => {
    const concepts = queryConcepts("white desk");
    const entry = item("White wood desk");
    const detail = conceptDetail(concepts, ["white", "wood", "desk"], extractItemConcepts(entry));
    expect([...detail.structural].sort(naturalOrder)).toEqual(["color WHITE", "productType DESK"]);
    expect([...detail.lexical].sort(naturalOrder)).toEqual(["color WHITE", "productType DESK"]);
  });

  it("Given a listing, When item concepts are read, Then title words count", () => {
    const concepts = extractItemConcepts(item("Kohler ceramic sink"));
    const found = concepts.map((concept) => `${concept.type}:${concept.value}`);
    expect(found).toContain("brand:KOHLER");
    expect(found).toContain("material:CERAMIC");
    expect(found).toContain("productType:SINK");
  });

  it("Given a matching material, When concepts are checked, Then they hold; a wrong material fails", () => {
    const concepts = queryConcepts("leather sofa");
    const match = item("Brown leather sofa");
    const miss = item("Blue fabric sofa");
    expect(
      satisfiesConcepts(concepts, ["brown", "leather", "sofa"], extractItemConcepts(match)),
    ).toBe(true);
    expect(satisfiesConcepts(concepts, ["blue", "fabric", "sofa"], extractItemConcepts(miss))).toBe(
      false,
    );
    const support = conceptSupport(
      concepts,
      ["brown", "leather", "sofa"],
      extractItemConcepts(match),
    );
    expect(support.structural).toBe(2);
    expect(support.lexical).toBe(2);
  });

  it("Given a listing from another brand, When the query brand is checked, Then the concepts fail", () => {
    const concepts = queryConcepts("kohler sink");
    const entry = item("Moen stainless steel sink");
    expect(
      satisfiesConcepts(
        concepts,
        ["moen", "stainless", "steel", "sink"],
        extractItemConcepts(entry),
      ),
    ).toBe(false);
  });
});
