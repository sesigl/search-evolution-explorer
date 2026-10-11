import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { understand } from "../query-understanding/understand.ts";
import { FEATURE_NAMES } from "../ranking/features.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker } from "./level-3-learned.ts";

const levers: LeverConfiguration = {
  stopWords: [],
  synonymGroups: [],
  variantRules: [],
};

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(id: string, title: string): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId: "sports",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

describe("level 3 learned ranking", () => {
  it("Given two candidates, When they are scored, Then each score is independent of the other candidate", () => {
    const a = item("a", "Golf clubs");
    const b = item("b", "Golf simulator");
    const items = [a, b];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const model = {
      variant: "corrected" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map((_, featureIndex) => (featureIndex === 0 ? 1 : 0)),
      bias: 0,
    };
    const ranker = createRanker({ corpus, index, levers, clock, model });
    const understanding = understand("golf clubs", levers, {}, []);
    const first = ranker.score(understanding, a);
    ranker.score(understanding, b);
    const again = ranker.score(understanding, a);
    expect(again.score).toBe(first.score);
    expect(first.signals.some((signal) => signal.name === "learnedScore")).toBe(true);
  });

  it("Given a zero-weight model, When a candidate is scored, Then the score is the model output and not the hand-tuned total", () => {
    const listing = item("a", "Golf clubs");
    const items = [listing];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const model = {
      variant: "corrected" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map(() => 0),
      bias: 0,
    };
    const ranker = createRanker({ corpus, index, levers, clock, model });
    const scored = ranker.score(understand("golf clubs", levers, {}, []), listing);
    expect(scored.score).toBe(0);
    expect(scored.signals.find((signal) => signal.name === "learnedScore")?.value).toBe(0);
    expect(scored.signals.some((signal) => signal.name === "bm25")).toBe(true);
  });

  it("Given no model artifact, When the ranker is created, Then scoring does not throw and the learned contribution is 0", () => {
    const listing = item("a", "Golf clubs");
    const corpus: CorpusSource = {
      readItems: async () => [listing],
      readCategories: async () => [],
    };
    const index = buildInvertedIndex([listing], (text) => analyzeDocument(text, levers));
    const ranker = createRanker({ corpus, index, levers, clock });
    const understanding = understand("golf clubs", levers, {}, []);
    const scored = ranker.score(understanding, listing);
    expect(scored.signals.find((signal) => signal.name === "learnedScore")?.value).toBe(0);
  });
});

describe("level 3 clock", () => {
  it("Given a clock that ticks while candidates are scored, When two identical listings are scored, Then they score the same", () => {
    const a = item("a", "Compact camera");
    const b = item("b", "Compact camera");
    const items = [a, b];
    const corpus: CorpusSource = {
      readItems: async () => items,
      readCategories: async () => [],
    };
    const index = buildInvertedIndex(items, (text) => analyzeDocument(text, levers));
    const model = {
      variant: "corrected" as const,
      featureNames: FEATURE_NAMES,
      weights: FEATURE_NAMES.map((name) => (name === "recency" ? -0.5 : 0)),
      bias: 43_350,
    };
    let tick = 0;
    const ticking: Clock = {
      now() {
        tick += 1;
        return new Date(Date.parse("2026-09-09T00:00:00.000Z") + tick);
      },
    };
    const ranker = createRanker({ corpus, index, levers, clock: ticking, model });
    const before = tick;
    const understanding = understand("camera", levers, {}, []);
    expect(ranker.score(understanding, a).score).toBe(ranker.score(understanding, b).score);
    expect(tick - before).toBe(1);
  });
});
