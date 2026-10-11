import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import { sampleSessions } from "./session-sampler.ts";

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

describe("click simulator", () => {
  it("Given a seed, When sessions are sampled twice, Then the log is identical byte for byte", () => {
    const shownByQuery = new Map([["sofa", [item("a", "Blue sofa"), item("b", "Red chair")]]]);
    const input = {
      queries: ["sofa"],
      shownByQuery,
      relevanceFor: (queryText: string, itemId: string) => (itemId === "a" ? 0.9 : 0.1),
      sessionCount: 20,
      seed: 42,
    };
    const first = JSON.stringify(sampleSessions(input));
    const second = JSON.stringify(sampleSessions(input));
    expect(first).toBe(second);
  });

  it("Given relevance times position decay, When sessions are sampled, Then the more relevant top item is clicked more often than a low item at the same rank", () => {
    const relevant = sampleSessions({
      queries: ["sofa"],
      shownByQuery: new Map([["sofa", [item("sofa", "Blue sofa")]]]),
      relevanceFor: () => 0.9,
      sessionCount: 80,
      seed: 7,
    });
    const irrelevant = sampleSessions({
      queries: ["sofa"],
      shownByQuery: new Map([["sofa", [item("chair", "Red chair")]]]),
      relevanceFor: () => 0.1,
      sessionCount: 80,
      seed: 7,
    });
    const highClicks = relevant.filter((session) => session.clickedItemIds.includes("sofa")).length;
    const lowClicks = irrelevant.filter((session) =>
      session.clickedItemIds.includes("chair"),
    ).length;
    expect(highClicks).toBeGreaterThan(lowClicks);
  });

  it("Given no queries, When sessions are sampled, Then the log is empty", () => {
    expect(
      sampleSessions({
        queries: [],
        shownByQuery: new Map(),
        relevanceFor: () => 1,
        sessionCount: 10,
        seed: 1,
      }),
    ).toEqual([]);
  });
});
