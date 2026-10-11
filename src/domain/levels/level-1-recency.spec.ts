import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { understand } from "../query-understanding/understand.ts";
import { recencyScore } from "../signals/recency.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker as createLexical } from "./level-1-lexical.ts";
import { createRanker as createNormalization } from "./level-1-normalization.ts";
import { createRanker, meta } from "./level-1-recency.ts";

const levers: LeverConfiguration = {
  stopWords: [],
  synonymGroups: [["couch", "sofa"]],
  variantRules: [],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(id: string, title: string, postedAt: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt,
    available: true,
  };
}

const couch = item("couch-new", "Grey couch", "2026-09-08T00:00:00.000Z");
const couchOld = item("couch-old", "Grey couch", "2026-08-01T00:00:00.000Z");
const sofaOnly = item("sofa-only", "Grey sofa", "2026-09-08T00:00:00.000Z");
const items = [couch, couchOld, sofaOnly];

function deps() {
  const corpus: CorpusSource = {
    readItems: async () => items,
    readCategories: async () => [],
  };
  const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
  return { corpus, index, levers, clock };
}

describe("level 1 recency search", () => {
  it("Given the registry, When the chapter is read, Then it is the first runnable chapter", () => {
    expect(meta.id).toBe("level-1-recency");
    expect(meta.ordinal).toBe(1);
    expect(meta.changes).toBe("both");
    expect(meta.guidedExamples.length).toBeGreaterThan(0);
  });

  it("Given 'couch' with synonyms on, When level 1 matches, Then the sofa-only listing stays out", () => {
    const ranker = createRanker(deps());
    const matched = ranker.match(understand("couch", levers, {}, []));
    expect(matched.items.map((entry) => entry.id).sort()).toEqual(["couch-new", "couch-old"]);
  });

  it("Given 'couch' with synonyms on, When chapter 2 matches, Then the sofa-only listing enters", () => {
    const normalization = createNormalization(deps());
    const matched = normalization.match(understand("couch", levers, {}, []));
    expect(matched.items.map((entry) => entry.id)).toContain("sofa-only");
  });

  it("Given 'couch' with synonyms on, When chapter 3 matches, Then it keeps the chapter 2 candidate set", () => {
    const normalization = createNormalization(deps());
    const lexical = createLexical(deps());
    const understanding = understand("couch", levers, {}, []);
    const expected = normalization
      .match(understanding)
      .items.map((entry) => entry.id)
      .sort();
    const actual = lexical
      .match(understanding)
      .items.map((entry) => entry.id)
      .sort();
    expect(actual).toEqual(expected);
  });

  it("Given two couch listings, When level 1 scores, Then the newer one ranks first by recency alone", () => {
    const ranker = createRanker(deps());
    const understanding = understand("couch", levers, {}, []);
    const scored = [couch, couchOld].map((entry) => ranker.score(understanding, entry));
    scored.sort((left, right) => right.score - left.score);
    expect(scored.map((entry) => entry.item.id)).toEqual(["couch-new", "couch-old"]);
    for (const entry of scored) {
      const signal = entry.signals.find((part) => part.name === "recency")?.value;
      expect(entry.score).toBeCloseTo(signal ?? Number.NaN, 12);
      expect(entry.score).toBeCloseTo(recencyScore(entry.item.postedAt, clock.now().getTime()), 12);
    }
  });

  it("Given an advancing clock, When two listings posted at the same moment are scored in either order, Then their scores match", () => {
    let tick = 0;
    const advancing: Clock = {
      now: () => new Date(Date.UTC(2026, 8, 9) + tick++ * 1000),
    };
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const ranker = createRanker({ corpus, index, levers, clock: advancing });
    const understanding = understand("couch", levers, {}, []);
    const [first, sameMomentButLater] = [couch, sofaOnly].map(
      (entry) => ranker.score(understanding, entry).score,
    );
    const [reversedFirst, reversedSecond] = [sofaOnly, couch].map(
      (entry) => ranker.score(understanding, entry).score,
    );
    expect(first).toBe(sameMomentButLater);
    expect([first, sameMomentButLater].sort()).toEqual([reversedFirst, reversedSecond].sort());
  });
});
