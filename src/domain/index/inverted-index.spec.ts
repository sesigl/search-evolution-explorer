import { describe, expect, it } from "vitest";
import { tokenize } from "../text/tokenize.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { buildInvertedIndex, matchTermGroups } from "./inverted-index.ts";

function item(id: string, title: string, available = true): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "sports",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available,
  };
}

describe("inverted index matching", () => {
  it("Given documents that contain the query terms, When matching runs, Then those documents are returned with no order claim", () => {
    const index = buildInvertedIndex([item("a", "red lamp"), item("b", "blue sofa")], tokenize);
    const ids = index.match(["lamp"]).items.map((entry) => entry.id);
    expect(ids).toEqual(["a"]);
  });

  it("Given an empty token list, When matching runs, Then no documents are returned", () => {
    const index = buildInvertedIndex([item("a", "red lamp")], tokenize);
    expect(index.match([]).items).toEqual([]);
  });

  it("Given two query terms, When matching runs, Then only documents that contain both terms are returned", () => {
    const index = buildInvertedIndex(
      [item("a", "red lamp"), item("b", "blue lamp"), item("c", "red sofa")],
      tokenize,
    );
    expect(index.match(["red", "lamp"]).items.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("Given an unavailable document, When matching runs, Then it is excluded", () => {
    const index = buildInvertedIndex([item("a", "red lamp", false)], tokenize);
    expect(index.match(["lamp"]).items).toEqual([]);
    expect(index.documentCount).toBe(0);
    expect(index.averageLength).toBe(1);
  });

  it("Given synonym alternatives for one term, When grouped matching runs, Then a document that contains either alternative is a candidate", () => {
    const index = buildInvertedIndex([item("a", "grey couch"), item("b", "blue sofa")], tokenize);
    const ids = matchTermGroups(index, [["couch", "sofa"]]).items.map((entry) => entry.id);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("Given no term groups, When grouped matching runs, Then no documents are returned", () => {
    const index = buildInvertedIndex([item("a", "red lamp")], tokenize);
    expect(matchTermGroups(index, []).items).toEqual([]);
  });

  it("Given two term groups, When grouped matching runs, Then only documents that satisfy every group are returned", () => {
    const index = buildInvertedIndex(
      [item("a", "red lamp"), item("b", "red sofa"), item("c", "blue lamp")],
      tokenize,
    );
    expect(matchTermGroups(index, [["red"], ["lamp"]]).items.map((entry) => entry.id)).toEqual([
      "a",
    ]);
  });

  it("Given a token that no document contains, When matching runs, Then no documents are returned", () => {
    const index = buildInvertedIndex([item("a", "red lamp")], tokenize);
    expect(index.match(["missing"]).items).toEqual([]);
  });

  it("Given repeated tokens in one document, When the index is built, Then document frequency counts the document once", () => {
    const index = buildInvertedIndex([item("a", "lamp lamp")], tokenize);
    expect(index.documentFrequency.get("lamp")).toBe(1);
    expect(index.averageLength).toBe(2);
    expect(index.documentCount).toBe(1);
  });

  it("Given two documents of different length, When the index is built, Then average length is total tokens divided by document count", () => {
    const index = buildInvertedIndex([item("a", "lamp"), item("b", "lamp lamp lamp")], tokenize);
    expect(index.documentCount).toBe(2);
    expect(index.averageLength).toBe(2);
  });
});
