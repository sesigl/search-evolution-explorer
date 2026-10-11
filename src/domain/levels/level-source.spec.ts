import { describe, expect, it } from "vitest";
import { UseCaseError } from "../search/errors.ts";
import { createRanker as createLevel0 } from "./level-0-evaluation.ts";
import level0Raw from "./level-0-evaluation.ts?raw";
import { createRanker as createCanonical } from "./level-1-canonical.ts";
import canonicalRaw from "./level-1-canonical.ts?raw";
import { createRanker as createEntities } from "./level-1-entities.ts";
import entitiesRaw from "./level-1-entities.ts?raw";
import { createRanker as createLevel1 } from "./level-1-lexical.ts";
import level1Raw from "./level-1-lexical.ts?raw";
import { createRanker as createNormalization } from "./level-1-normalization.ts";
import normalizationRaw from "./level-1-normalization.ts?raw";
import { createRanker as createRecency } from "./level-1-recency.ts";
import recencyRaw from "./level-1-recency.ts?raw";
import { createRanker as createSpelling } from "./level-1-spelling.ts";
import spellingRaw from "./level-1-spelling.ts?raw";
import { createRanker as createLevel2 } from "./level-2-boosting.ts";
import level2Raw from "./level-2-boosting.ts?raw";
import { createRanker as createLevel3 } from "./level-3-learned.ts";
import level3Raw from "./level-3-learned.ts?raw";
import { createRanker as createLevel4 } from "./level-4-hybrid.ts";
import level4Raw from "./level-4-hybrid.ts?raw";
import { createRanker as createLevel5 } from "./level-5-cross-encoder.ts";
import level5Raw from "./level-5-cross-encoder.ts?raw";
import { createRanker as createLevel6 } from "./level-6-two-tower.ts";
import level6Raw from "./level-6-two-tower.ts?raw";
import { levels } from "./level-registry.ts";
import { RANKER_EXPORT_SYMBOL, rawSourceFor, resolveLevelSource } from "./level-source.ts";

describe("level source display", () => {
  it("Given every implemented level, When the display text is loaded via ?raw from the same specifier the pipeline imports, Then that text contains the exported ranker symbol", () => {
    const executed = new Map<string, unknown>([
      ["level-0-evaluation", createLevel0],
      ["level-1-recency", createRecency],
      ["level-1-normalization", createNormalization],
      ["level-1-lexical", createLevel1],
      ["level-1-spelling", createSpelling],
      ["level-1-entities", createEntities],
      ["level-1-canonical", createCanonical],
      ["level-2-boosting", createLevel2],
      ["level-3-learned", createLevel3],
      ["level-4-hybrid", createLevel4],
      ["level-5-cross-encoder", createLevel5],
      ["level-6-two-tower", createLevel6],
    ]);
    const displayed = new Map([
      ["level-0-evaluation", level0Raw],
      ["level-1-recency", recencyRaw],
      ["level-1-normalization", normalizationRaw],
      ["level-1-lexical", level1Raw],
      ["level-1-spelling", spellingRaw],
      ["level-1-entities", entitiesRaw],
      ["level-1-canonical", canonicalRaw],
      ["level-2-boosting", level2Raw],
      ["level-3-learned", level3Raw],
      ["level-4-hybrid", level4Raw],
      ["level-5-cross-encoder", level5Raw],
      ["level-6-two-tower", level6Raw],
    ]);

    for (const level of levels.filter((entry) => entry.implemented)) {
      const factory = executed.get(level.id);
      const raw = displayed.get(level.id);
      expect(factory).toBeTypeOf("function");
      expect(raw).toBe(rawSourceFor(level.sourceSpecifier));
      expect(raw).toContain(`export function ${RANKER_EXPORT_SYMBOL}`);
    }
  });

  it("Given an unknown level, When source is requested, Then the request is rejected", () => {
    expect(() => resolveLevelSource("level-99", levels)).toThrow(UseCaseError);
  });

  it("Given level 2, When source is requested, Then the line count matches the displayed source and the composition point is reported", () => {
    const output = resolveLevelSource("level-2-boosting", levels);
    const expectedLines = output.source.endsWith("\n")
      ? output.source.split("\n").length - 1
      : output.source.split("\n").length;

    expect(output.sourcePath).toBe("src/domain/levels/level-2-boosting.ts");
    expect(output.source).toContain("export function createRanker");
    expect(output.lineCount).toBe(expectedLines);
    expect(output.composesLevelId).toBe("level-1-canonical");
    expect(output.compositionPointLine).toBeGreaterThan(0);
  });

  it("Given a forward-preview level, When source is requested, Then the request is rejected", () => {
    const lexical = levels.find((level) => level.id === "level-1-lexical");
    if (lexical === undefined) {
      throw new Error("level-1-lexical is missing from the registry");
    }
    const preview = {
      ...lexical,
      id: "level-9-preview",
      implemented: false,
    };
    expect(() => resolveLevelSource("level-9-preview", [...levels, preview])).toThrow(UseCaseError);
  });
});
