import { describe, expect, it } from "vitest";
import { tokenize } from "../text/tokenize.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { bm25Score, documentFrequencyOf } from "./bm25.ts";

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

describe("BM25 scoring", () => {
  it("Given a term that occurs more often, When BM25 is computed, Then the repeated document scores higher", () => {
    const docs = [item("once", "lamp"), item("twice", "lamp lamp")];
    const stats = documentFrequencyOf(docs, tokenize);
    const once = bm25Score(
      ["lamp"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const twice = bm25Score(
      ["lamp"],
      docs[1] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    expect(twice).toBeGreaterThan(once);
  });

  it("Given no available documents, When collection statistics are computed, Then the average length is one", () => {
    expect(documentFrequencyOf([], tokenize)).toEqual({
      documentCount: 0,
      averageLength: 1,
      documentFrequency: new Map(),
    });
  });

  it("Given a document without the query term, When BM25 is computed, Then the score is zero", () => {
    const docs = [item("a", "sofa")];
    const stats = documentFrequencyOf(docs, tokenize);
    expect(
      bm25Score(
        ["lamp"],
        docs[0] as CorpusItem,
        stats.documentCount,
        stats.averageLength,
        stats.documentFrequency,
        tokenize,
      ),
    ).toBe(0);
  });

  it("Given rising term frequency, When BM25 is computed, Then extra occurrences add less each time", () => {
    const docs = [
      item("one", "lamp"),
      item("many", "lamp lamp lamp lamp lamp"),
      item("more", "lamp lamp lamp lamp lamp lamp lamp lamp lamp lamp"),
    ];
    const stats = documentFrequencyOf(docs, tokenize);
    const one = bm25Score(
      ["lamp"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const many = bm25Score(
      ["lamp"],
      docs[1] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const more = bm25Score(
      ["lamp"],
      docs[2] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    expect(many - one).toBeGreaterThan(more - many);
  });

  it("Given the same term frequency, When one document is longer, Then the longer document scores lower", () => {
    const docs = [item("short", "lamp"), item("long", "lamp chair table sofa desk")];
    const stats = documentFrequencyOf(docs, tokenize);
    const short = bm25Score(
      ["lamp"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const long = bm25Score(
      ["lamp"],
      docs[1] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    expect(short).toBeGreaterThan(long);
  });

  it("Given a known collection, When BM25 is computed, Then the score matches the Robertson formula", () => {
    const docs = [item("once", "lamp"), item("twice", "lamp lamp")];
    const stats = documentFrequencyOf(docs, tokenize);
    const k1 = 1.2;
    const b = 0.75;
    const termFrequency = 1;
    const length = 1;
    const documentFrequency = 2;
    const documentCount = 2;
    const averageLength = 1.5;
    const idf = Math.log(1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const numerator = termFrequency * (k1 + 1);
    const denominator = termFrequency + k1 * (1 - b + b * (length / averageLength));
    expect(
      bm25Score(
        ["lamp"],
        docs[0] as CorpusItem,
        stats.documentCount,
        stats.averageLength,
        stats.documentFrequency,
        tokenize,
      ),
    ).toBeCloseTo(idf * (numerator / denominator), 10);
  });

  it("Given two query terms that both occur, When BM25 is computed, Then the score is the sum of the per-term contributions", () => {
    const docs = [item("both", "red lamp")];
    const stats = documentFrequencyOf(docs, tokenize);
    const red = bm25Score(
      ["red"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const lamp = bm25Score(
      ["lamp"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    const both = bm25Score(
      ["red", "lamp"],
      docs[0] as CorpusItem,
      stats.documentCount,
      stats.averageLength,
      stats.documentFrequency,
      tokenize,
    );
    expect(both).toBeCloseTo(red + lamp, 10);
  });

  it("Given an unavailable document, When collection statistics are computed, Then it does not contribute document frequency", () => {
    const gone = { ...item("gone", "lamp"), available: false };
    const stats = documentFrequencyOf([gone, item("live", "lamp lamp")], tokenize);
    expect(stats.documentCount).toBe(1);
    expect(stats.documentFrequency.get("lamp")).toBe(1);
    expect(stats.averageLength).toBe(2);
  });
});
