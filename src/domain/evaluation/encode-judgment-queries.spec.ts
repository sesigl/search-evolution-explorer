import { describe, expect, it, vi } from "vitest";
import type { QueryEncoder } from "../ports/query-encoder.ts";
import type { LevelRanker } from "../types/level.ts";
import { encodeJudgmentQueries } from "./encode-judgment-queries.ts";

const encoder: QueryEncoder = {
  encode(text: string) {
    return Promise.resolve(Float32Array.from([text.length]));
  },
};

describe("scorecard query encoding", () => {
  it("uses the same corrected text as live search, including when only chapter 9 is available", async () => {
    const encode = vi.fn(async () => Float32Array.from([1]));
    const ranker: LevelRanker = {
      match: () => ({ items: [] }),
      score: (_understanding, candidate) => ({ item: candidate, score: 0, signals: [] }),
    };
    const vectors = await encodeJudgmentQueries(
      { encode },
      [{ queryText: "ligth", itemId: "bulb", grade: 3 }],
      new Map([["level-5-cross-encoder", ranker]]),
    );
    expect(encode).toHaveBeenCalledExactlyOnceWith("light");
    expect(vectors.get("ligth")).toEqual(Float32Array.from([1]));
  });
  it("Given no hybrid ranker, When judgment queries are encoded, Then no vectors are produced", async () => {
    const vectors = await encodeJudgmentQueries(
      encoder,
      [{ queryText: "lamp", itemId: "a", grade: 3 }],
      new Map(),
    );
    expect(vectors.size).toBe(0);
  });

  it("Given no encoder, When judgment queries are encoded, Then no vectors are produced", async () => {
    const rankers = new Map<string, LevelRanker>([
      [
        "level-4-hybrid",
        {
          match() {
            return { items: [] };
          },
          score(_understanding, candidate) {
            return { item: candidate, score: 0, signals: [] };
          },
        },
      ],
    ]);
    const vectors = await encodeJudgmentQueries(
      undefined,
      [{ queryText: "lamp", itemId: "a", grade: 3 }],
      rankers,
    );
    expect(vectors.size).toBe(0);
  });

  it("Given a hybrid ranker, When judgment queries are encoded, Then each unique query has a vector", async () => {
    const rankers = new Map<string, LevelRanker>([
      [
        "level-4-hybrid",
        {
          match() {
            return { items: [] };
          },
          score(_understanding, candidate) {
            return { item: candidate, score: 0, signals: [] };
          },
        },
      ],
    ]);
    const vectors = await encodeJudgmentQueries(
      encoder,
      [
        { queryText: "lamp", itemId: "a", grade: 3 },
        { queryText: "lamp", itemId: "b", grade: 1 },
      ],
      rankers,
    );
    expect(vectors.get("lamp")).toEqual(Float32Array.from([4]));
  });
});
