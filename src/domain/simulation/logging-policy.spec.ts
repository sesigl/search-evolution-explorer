import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import { shownInRecencyOrder } from "./logging-policy.ts";

function item(id: string, postedAt: string, available = true): CorpusItem {
  return {
    id,
    title: id,
    description: "",
    categoryId: "furniture",
    priceCents: 1,
    location: "Berlin",
    postedAt,
    available,
  };
}

describe("logging policy", () => {
  it("Given mixed listings, When shown in recency order, Then newer available items come first", () => {
    const shown = shownInRecencyOrder(
      [
        item("old", "2026-01-01T00:00:00.000Z"),
        item("new", "2026-09-08T00:00:00.000Z"),
        item("gone", "2026-09-09T00:00:00.000Z", false),
      ],
      10,
    );
    expect(shown.map((entry) => entry.id)).toEqual(["new", "old"]);
  });
});
