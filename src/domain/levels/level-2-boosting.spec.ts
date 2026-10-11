import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { understand } from "../query-understanding/understand.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker as createPrevious } from "./level-1-entities.ts";
import { createRanker as createLevel1 } from "./level-1-lexical.ts";
import { createRanker as createLevel2 } from "./level-2-boosting.ts";

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

function item(id: string, title: string, categoryId: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId,
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

describe("level 2 boosting", () => {
  it("Given a category query, When level 2 scores, Then the matching category ranks higher than at level 1", () => {
    const items = [
      item("sports-golf", "Golf clubs set", "sports"),
      item("electronics-golf", "Golf simulator screen", "electronics"),
    ];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const deps = { corpus, index, levers, clock };
    const level1 = createLevel1(deps);
    const previous = createPrevious(deps);
    const level2 = createLevel2(deps);
    const understanding = understand("golf clubs", levers, {}, []);
    const left = items.map((entry) => level1.score(understanding, entry));
    const right = items.map((entry) => level2.score(understanding, entry));
    left.sort((a, b) => b.score - a.score);
    right.sort((a, b) => b.score - a.score);
    expect(right[0]?.item.id).toBe("sports-golf");
    expect(
      level2
        .match(understanding)
        .items.map((entry) => entry.id)
        .sort(),
    ).toEqual(
      previous
        .match(understanding)
        .items.map((entry) => entry.id)
        .sort(),
    );
  });

  it("Given a price constraint, When level 2 scores, Then a listing over the bound gets no price-fit boost", () => {
    const cheap: CorpusItem = {
      ...item("cheap", "USB cable", "electronics"),
      priceCents: 500,
    };
    const dear: CorpusItem = {
      ...item("dear", "USB cable", "electronics"),
      priceCents: 80_000,
    };
    const items = [cheap, dear];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const ranker = createLevel2({ corpus, index, levers, clock });
    const understanding = understand("usb under 20", levers, {}, []);
    const cheapFit = ranker
      .score(understanding, cheap)
      .signals.find((signal) => signal.name === "priceFit")?.value;
    const dearFit = ranker
      .score(understanding, dear)
      .signals.find((signal) => signal.name === "priceFit")?.value;
    expect(cheapFit).toBe(1);
    expect(dearFit).toBe(0);
  });

  it("Given two prices in one category, When level 2 scores, Then the dearer listing has a higher price-percentile signal", () => {
    const cheap: CorpusItem = {
      ...item("cheap", "USB cable extra long", "electronics"),
      priceCents: 500,
    };
    const dear: CorpusItem = {
      ...item("dear", "USB cable extra long", "electronics"),
      priceCents: 80_000,
    };
    const items = [cheap, dear];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const ranker = createLevel2({ corpus, index, levers, clock });
    const understanding = understand("usb cable", levers, {}, []);
    const cheapPercentile = ranker
      .score(understanding, cheap)
      .signals.find((signal) => signal.name === "pricePercentile")?.value;
    const dearPercentile = ranker
      .score(understanding, dear)
      .signals.find((signal) => signal.name === "pricePercentile")?.value;
    expect(dearPercentile ?? 0).toBeGreaterThan(cheapPercentile ?? 0);
  });

  it("Given a corrected query, When level 2 scores, Then the weighted signals sum to the score", () => {
    const phone = item("phone", "iPhone cable", "electronics");
    const items = [phone, item("phone2", "iPhone charger", "electronics")];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const ranker = createLevel2({ corpus, index, levers, clock });
    const understanding = understand("iphne iphone", levers, {}, []);
    const scored = ranker.score(understanding, phone);
    expect(
      scored.signals.find((signal) => signal.name === "spellingCorrection")?.weight,
    ).toBeUndefined();
    const total = scored.signals
      .filter((signal) => signal.weight !== undefined)
      .reduce((sum, signal) => sum + (signal.weight ?? 0) * signal.value, 0);
    expect(total).toBeCloseTo(scored.score, 10);
  });
});
