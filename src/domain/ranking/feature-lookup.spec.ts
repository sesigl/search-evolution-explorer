import { describe, expect, it } from "vitest";
import { buildInvertedIndex } from "../index/inverted-index.ts";
import type { Clock } from "../ports/clock.ts";
import { analyzeDocument } from "../text/analyze-document.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { LeverConfiguration } from "../types/query.ts";
import { createFeatureLookup } from "./feature-lookup.ts";
import { FEATURE_NAMES } from "./features.ts";

const levers: LeverConfiguration = { stopWords: [], synonymGroups: [], variantRules: [] };
const clock: Clock = { now: () => new Date("2026-09-09T00:00:00.000Z") };

describe("feature lookup", () => {
  it("Given a known item, When features are requested twice, Then the vector is stable and has one value per feature name", () => {
    const item: CorpusItem = {
      id: "sofa",
      title: "Blue sofa",
      description: "",
      categoryId: "furniture",
      priceCents: 1000,
      location: "Berlin",
      postedAt: "2026-09-01T00:00:00.000Z",
      available: true,
    };
    const index = buildInvertedIndex([item], (text) => analyzeDocument(text, levers));
    const lookup = createFeatureLookup([item], index, levers, clock);
    const first = lookup("sofa", "sofa");
    const second = lookup("sofa", "sofa");
    expect(first).toHaveLength(FEATURE_NAMES.length);
    expect(second).toBe(first);
    expect(lookup("sofa", "missing")).toBeUndefined();
  });
});
