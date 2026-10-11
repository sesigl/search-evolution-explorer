import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import type { RankedResult } from "../types/ranking.ts";
import { compareRankings } from "./compare.ts";

const matchingReason = /matching/i;

function item(id: string): CorpusItem {
  return {
    id,
    title: id,
    description: "",
    categoryId: "sports",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
  };
}

function result(id: string, position: number, signalName: string, value: number): RankedResult {
  return {
    item: item(id),
    position,
    score: value,
    signals: [{ name: signalName, value, explanation: signalName }],
  };
}

describe("ranking comparison", () => {
  it("Given an unchanged joint score, When added candidates move a result, Then the explanation attributes the move to the surrounding ranking", () => {
    const comparison = compareRankings(
      [result("a", 1, "crossEncoder", 2)],
      [result("a", 2, "crossEncoder", 2)],
      "matching",
    );
    expect(comparison.moved[0]?.attributedSignal).toBe("candidateCompetition");
  });
  it("attributes neural reranking to joint relevance rather than the larger previous-rank context", () => {
    const before = result("a", 1, "rrf", 0.03);
    const after = result("a", 2, "crossEncoder", -2);
    const contextual = {
      ...after,
      signals: [...after.signals, { name: "previousRank", value: 40, explanation: "context" }],
    };
    expect(compareRankings([before], [contextual], "scoring").moved[0]?.attributedSignal).toBe(
      "crossEncoder",
    );
    expect(compareRankings([contextual], [before], "scoring").moved[0]?.attributedSignal).toBe(
      "crossEncoder",
    );
  });
  it("Given an item only on the right, When the rankings are compared, Then it is marked entered", () => {
    const comparison = compareRankings(
      [result("a", 1, "bm25", 1)],
      [result("a", 1, "bm25", 1), result("b", 2, "bm25", 0.5)],
      "matching",
    );
    expect(comparison.entered.map((entry) => entry.itemId)).toEqual(["b"]);
    expect(comparison.entered[0]?.reason).toMatch(matchingReason);
  });

  it("Given an item only on the left, When the rankings are compared, Then it is marked exited", () => {
    const comparison = compareRankings(
      [result("a", 1, "bm25", 1), result("b", 2, "bm25", 0.5)],
      [result("a", 1, "bm25", 1)],
      "matching",
    );
    expect(comparison.exited.map((entry) => entry.itemId)).toEqual(["b"]);
  });

  it("Given an item that changes position, When the rankings are compared, Then the move is attributed to a signal", () => {
    const comparison = compareRankings(
      [result("a", 1, "bm25", 2), result("b", 2, "categoryMatch", 0)],
      [result("b", 1, "categoryMatch", 2), result("a", 2, "bm25", 2)],
      "scoring",
    );
    expect(comparison.moved[0]?.itemId).toBe("b");
    expect(comparison.moved[0]?.fromPosition).toBe(2);
    expect(comparison.moved[0]?.toPosition).toBe(1);
    expect(comparison.moved[0]?.attributedSignal).toBe("categoryMatch");
  });

  it("Given an item only on the right of a scoring comparison, When the rankings are compared, Then the reason is scoring", () => {
    const comparison = compareRankings(
      [result("a", 1, "bm25", 1)],
      [result("a", 1, "bm25", 1), result("b", 2, "bm25", 0.5)],
      "scoring",
    );
    expect(comparison.entered[0]?.reason).toMatch(/scoring/i);
  });

  it("Given identical rankings, When they are compared, Then identical is true", () => {
    const list = [result("a", 1, "bm25", 1)];
    expect(compareRankings(list, list, "scoring").identical).toBe(true);
  });
});
