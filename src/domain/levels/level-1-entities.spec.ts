import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import { understand } from "../query-understanding/understand.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createRanker as createEntities } from "./level-1-entities.ts";
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
    categoryId: "Furniture",
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

describe("level 1 entities", () => {
  it("Given a synonym concept, When entities match, Then a listing without the raw word is added", () => {
    const items = [
      item("sofa", "Blue sofa"),
      item("sofa2", "Grey sofa"),
      item("table", "Oak table"),
    ];
    const deps = depsFor(items);
    const spelling = createSpelling(deps);
    const entities = createEntities(deps);
    const understanding = understand("couch", levers, {}, []);
    const spellingIds = spelling.match(understanding).items.map((entry) => entry.id);
    const entityIds = entities.match(understanding).items.map((entry) => entry.id);
    expect(spellingIds).not.toContain("sofa");
    expect(entityIds).toContain("sofa");
    expect(entityIds).not.toContain("table");
    for (const id of spellingIds) {
      expect(entityIds).toContain(id);
    }
  });

  it("Given a synonym, When entities match, Then both wordings are found", () => {
    const items = [item("rug", "Wool rug"), item("carpet", "Wool carpet")];
    const deps = depsFor(items);
    const entities = createEntities(deps);
    const understanding = understand("rug", levers, {}, []);
    expect(
      entities
        .match(understanding)
        .items.map((entry) => entry.id)
        .sort(naturalOrder),
    ).toEqual(["carpet", "rug"]);
  });

  it("Given a query without concepts, When entities match, Then the set equals spelling", () => {
    const items = [item("sofa", "Blue sofa")];
    const deps = depsFor(items);
    const spelling = createSpelling(deps);
    const entities = createEntities(deps);
    const understanding = understand("unlocked", levers, {}, []);
    expect(entities.match(understanding).items.map((entry) => entry.id)).toEqual(
      spelling.match(understanding).items.map((entry) => entry.id),
    );
    expect(entities.conceptsFor?.(understanding)).toEqual([]);
  });

  it("Given an attribute match, When entities score, Then structural and lexical signals carry their weights", () => {
    const sofa = item("sofa", "Blue sofa");
    const deps = depsFor([sofa]);
    const entities = createEntities(deps);
    const understanding = understand("couch", levers, {}, []);
    const scored = entities.score(understanding, sofa);
    const structural = scored.signals.find((signal) => signal.name === "structuredConceptMatch");
    const lexical = scored.signals.find((signal) => signal.name === "lexicalConceptMatch");
    expect(structural?.value).toBe(1);
    expect(structural?.weight).toBe(1);
    expect(lexical?.value).toBe(1);
    expect(lexical?.weight).toBe(0.5);
    expect(entities.conceptsFor?.(understanding).map((concept) => concept.value)).toEqual(["SOFA"]);
  });

  it("Given a typo with a concept, When entities run, Then the spelling fix still applies", () => {
    const items = [item("bulb", "Light bulb pack"), item("strip", "Light strip")];
    const deps = depsFor(items);
    const entities = createEntities(deps);
    const understanding = understand("ligth bulb", levers, {}, []);
    expect(entities.match(understanding).items.map((entry) => entry.id)).toContain("bulb");
    expect(entities.correctionsFor?.(understanding)).toContainEqual({ from: "ligth", to: "light" });
  });

  it("Given a typo, When concepts are read, Then they come from the corrected words", () => {
    const items = [item("chair", "Black chair"), item("chair2", "Black stool")];
    const deps = depsFor(items);
    const entities = createEntities(deps);
    const understanding = understand("blk chair", levers, {}, []);
    expect(
      entities
        .conceptsFor?.(understanding)
        .map((concept) => concept.value)
        .sort(naturalOrder),
    ).toEqual(["BLACK", "CHAIR"]);
  });
});
