import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import { itemText } from "./item-text.ts";

describe("item text", () => {
  it("Given a listing, When item text is built, Then title and description are joined with a space", () => {
    const listing: CorpusItem = {
      id: "sofa",
      title: "Blue sofa",
      description: "Three seats",
      categoryId: "furniture",
      priceCents: 1000,
      location: "Berlin",
      postedAt: "2026-09-01T00:00:00.000Z",
      available: true,
    };
    expect(itemText(listing)).toBe("Blue sofa Three seats");
  });
});
