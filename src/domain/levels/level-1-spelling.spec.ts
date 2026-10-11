import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { understand } from "../query-understanding/understand.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import { buildVocabulary, correctTokens } from "../text/spell-correction.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker as createLexical } from "./level-1-lexical.ts";
import { createRanker as createSpelling } from "./level-1-spelling.ts";

const levers: LeverConfiguration = {
  stopWords: ["a", "the"],
  synonymGroups: [],
  variantRules: [],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function naturalOrder(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function item(id: string, title: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "Lighting",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function depsFor(items: CorpusItem[]) {
  const corpus: CorpusSource = {
    readItems: async () => items,
    readCategories: async () => [],
  };
  const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
  return { corpus, index, levers, clock };
}

let cachedCorpusTexts: string[] | undefined;

/** Reads and tokenises the 30 MB committed corpus once, so the suite does not do it twice. */
function corpusTexts(): string[] {
  cachedCorpusTexts ??= readFileSync("data/corpus.ndjson", "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line))
    .map((entry) => `${entry.title} ${entry.description}`);
  return cachedCorpusTexts;
}

describe("level 1 spelling", () => {
  it("Given a typo, When spelling matches, Then the corrected word retrieves what lexical misses", () => {
    const items = [item("bulb", "Light bulb pack"), item("strip", "Light strip")];
    const deps = depsFor(items);
    const lexical = createLexical(deps);
    const spelling = createSpelling(deps);
    const understanding = understand("ligth", levers, {}, []);
    expect(lexical.match(understanding).items).toEqual([]);
    expect(
      spelling
        .match(understanding)
        .items.map((entry) => entry.id)
        .sort(naturalOrder),
    ).toEqual(["bulb", "strip"]);
    expect(spelling.correctionsFor?.(understanding)).toEqual([{ from: "ligth", to: "light" }]);
  });

  it("Given a clean query, When spelling runs, Then matching and scoring equal lexical", () => {
    const items = [item("bulb", "Light bulb pack")];
    const deps = depsFor(items);
    const lexical = createLexical(deps);
    const spelling = createSpelling(deps);
    const understanding = understand("light", levers, {}, []);
    expect(spelling.match(understanding).items.map((entry) => entry.id)).toEqual(
      lexical.match(understanding).items.map((entry) => entry.id),
    );
    expect(spelling.score(understanding, items[0] as CorpusItem).score).toBe(
      lexical.score(understanding, items[0] as CorpusItem).score,
    );
    expect(spelling.correctionsFor?.(understanding)).toEqual([]);
  });

  it("Given a typo, When spelling scores, Then the correction signal is set and the score uses corrected words", () => {
    const items = [item("bulb", "Light bulb pack"), item("strip", "Light strip")];
    const deps = depsFor(items);
    const spelling = createSpelling(deps);
    const understanding = understand("ligth", levers, {}, []);
    const scored = spelling.score(understanding, items[0] as CorpusItem);
    expect(scored.signals.find((signal) => signal.name === "spellingCorrection")?.value).toBe(1);
    const clean = understand("light", levers, {}, []);
    expect(scored.score).toBe(spelling.score(clean, items[0] as CorpusItem).score);
  });

  it("Given the real corpus vocabulary, When words are looked up, Then the correct word is known and the typo is not", {
    timeout: 30_000,
  }, () => {
    const vocabulary = buildVocabulary(corpusTexts(), 2);
    expect(vocabulary.has("light")).toBe(true);
    expect(vocabulary.has("ligth")).toBe(false);
  });

  it("Given the real corpus vocabulary, When a known word is queried, Then it is not rewritten", {
    timeout: 30_000,
  }, () => {
    const vocabulary = buildVocabulary(corpusTexts(), 2);
    expect(correctTokens(["lamp"], vocabulary).corrections).toEqual([]);
  });

  it("Given a hardcoded compound typo, When spelling runs, Then the split is recorded", () => {
    const items = [item("bulb", "Light bulb pack")];
    const deps = depsFor(items);
    const spelling = createSpelling(deps);
    const understanding = understand("roomtables", levers, {}, []);
    expect(spelling.correctionsFor?.(understanding)).toContainEqual({
      from: "roomtables",
      to: "room tables",
    });
  });
});
