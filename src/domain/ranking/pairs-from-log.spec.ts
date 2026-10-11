import { describe, expect, it } from "vitest";
import { pairsFromLog } from "./pairs-from-log.ts";

describe("pairs from click log", () => {
  it("Given a clicked item and an unclicked item, When pairs are built, Then naive weight is 1 and corrected weight is inverse propensity", () => {
    const features = new Map([
      ["a", [1, 0]],
      ["b", [0, 1]],
    ]);
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["a", "b"],
          clickedItemIds: ["b"],
        },
      ],
      (_query, itemId) => features.get(itemId),
      [1, 0.5],
    );
    expect(pairs.naive).toHaveLength(1);
    expect(pairs.naive[0]?.weight).toBe(1);
    expect(pairs.corrected[0]?.weight).toBe(2);
    expect(pairs.naive[0]?.better).toEqual([0, 1]);
    expect(pairs.naive[0]?.worse).toEqual([1, 0]);
  });

  it("Given a click at rank 1, When pairs are built, Then the corrected weight is 1", () => {
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["a", "b"],
          clickedItemIds: ["a"],
        },
      ],
      (_query, itemId) => (itemId === "a" ? [1] : [0]),
      [1, 0.5],
    );
    expect(pairs.corrected[0]?.weight).toBe(1);
  });

  it("Given a shown item without features, When pairs are built, Then that item is skipped", () => {
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["a", "b"],
          clickedItemIds: ["a"],
        },
      ],
      (_query, itemId) => (itemId === "a" ? [1] : undefined),
      [1, 0.5],
    );
    expect(pairs.naive).toEqual([]);
    expect(pairs.corrected).toEqual([]);
  });

  it("Given a clicked item without features, When pairs are built, Then no pair is produced", () => {
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["missing", "b"],
          clickedItemIds: ["missing"],
        },
      ],
      (_query, itemId) => (itemId === "b" ? [0] : undefined),
      [1, 0.5],
    );
    expect(pairs.naive).toEqual([]);
  });

  it("Given a long shown list, When pairs are built, Then negatives per click are capped", () => {
    const shownItemIds = Array.from({ length: 40 }, (_, index) => `item-${String(index)}`);
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds,
          clickedItemIds: ["item-20"],
        },
      ],
      () => [1],
      Array.from({ length: 40 }, () => 0.1),
    );
    expect(pairs.naive).toHaveLength(16);
  });

  it("Given every shown item was clicked, When pairs are built, Then no pair is produced", () => {
    const pairs = pairsFromLog(
      [
        {
          sessionId: "s1",
          queryText: "q",
          shownItemIds: ["a", "b"],
          clickedItemIds: ["a", "b"],
        },
      ],
      () => [1],
      [1, 0.5],
    );
    expect(pairs.naive).toEqual([]);
  });

  it("Given exactly the cap in negatives, When pairs are built, Then every negative is used in shown order", () => {
    const shownItemIds = Array.from({ length: 17 }, (_, index) => `item-${index}`);
    const pairs = pairsFromLog(
      [{ sessionId: "s1", queryText: "q", shownItemIds, clickedItemIds: ["item-0"] }],
      byId,
      decay(17),
    );
    expect(pairs.naive.map((pair) => pair.worse[0])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it("Given more negatives than the cap, When pairs are built, Then the head is kept and the tail is sampled deterministically", () => {
    const shownItemIds = Array.from({ length: 40 }, (_, index) => `item-${index}`);
    const pairs = pairsFromLog(
      [{ sessionId: "s1", queryText: "q", shownItemIds, clickedItemIds: ["item-20"] }],
      byId,
      decay(40),
    );
    expect(pairs.naive.map((pair) => pair.worse[0])).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it("Given a click at the highest corrected rank, When pairs are built, Then the corrected pair keeps the inverse-propensity weight", () => {
    const shownItemIds = Array.from({ length: 40 }, (_, index) => `item-${index}`);
    const pairs = pairsFromLog(
      [{ sessionId: "s1", queryText: "q", shownItemIds, clickedItemIds: ["item-19"] }],
      byId,
      decay(40),
    );
    expect(pairs.corrected).toHaveLength(16);
    for (const pair of pairs.corrected) {
      // Inverse propensity is capped at 8, so a 0.1 decay at rank 20 pins every weight to 8.
      expect(pair.weight).toBe(8);
    }
  });

  it("Given a click past the highest corrected rank, When pairs are built, Then only the naive pair is produced", () => {
    const shownItemIds = Array.from({ length: 40 }, (_, index) => `item-${index}`);
    const pairs = pairsFromLog(
      [{ sessionId: "s1", queryText: "q", shownItemIds, clickedItemIds: ["item-20"] }],
      byId,
      decay(40),
    );
    expect(pairs.naive).toHaveLength(16);
    expect(pairs.corrected).toEqual([]);
  });

  it("Given a click that is not in the shown list, When pairs are built, Then no corrected pair is produced", () => {
    const pairs = pairsFromLog(
      [{ sessionId: "s1", queryText: "q", shownItemIds: ["a", "b"], clickedItemIds: ["missing"] }],
      byId,
      [1, 0.5],
    );
    expect(pairs.naive).toHaveLength(2);
    expect(pairs.corrected).toEqual([]);
  });
});

const ITEM_ID = /^item-(\d+)$/;

function byId(_queryText: string, itemId: string): number[] | undefined {
  const index = ITEM_ID.exec(itemId);
  return index === null ? [1] : [Number(index[1])];
}

function decay(length: number): number[] {
  return Array.from({ length }, () => 0.1);
}
