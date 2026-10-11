import { describe, expect, it } from "vitest";
import { UseCaseError } from "../search/errors.ts";
import type { EvolutionLevel } from "../types/level.ts";
import { requireImplementedLevel, requireLevel } from "./require-level.ts";

function level(overrides: Partial<EvolutionLevel> = {}): EvolutionLevel {
  return {
    id: "level-1-lexical",
    ordinal: 1,
    label: "Lexical match",
    capability: "Match terms",
    changes: "both",
    mechanism: "mechanism",
    tradeOff: "trade-off",
    fixesFailureMode: null,
    prerequisites: [],
    sourceSpecifier: "src/domain/levels/level-1-lexical.ts",
    implemented: true,
    guidedExamples: [],
    candidateWidth: 10,
    ...overrides,
  };
}

describe("require level", () => {
  it("Given a known level id, When the level is required, Then that level is returned", () => {
    const lexical = level();
    expect(requireLevel([lexical], "level-1-lexical")).toBe(lexical);
  });

  it("Given an unknown level id, When the level is required, Then the request is rejected", () => {
    expect(() => requireLevel([level()], "level-99")).toThrow(UseCaseError);
    expect(() => requireLevel([level()], "level-99")).toThrow("Unknown level: level-99");
  });

  it("Given an implemented level, When an implemented level is required, Then that level is returned", () => {
    const lexical = level();
    expect(requireImplementedLevel([lexical], "level-1-lexical")).toBe(lexical);
  });

  it("Given a forward-preview level, When an implemented level is required, Then the request is rejected", () => {
    const preview = level({
      id: "level-5-cross-encoder",
      label: "Cross-encoder preview",
      implemented: false,
    });
    expect(() => requireImplementedLevel([preview], "level-5-cross-encoder")).toThrow(UseCaseError);
    expect(() => requireImplementedLevel([preview], "level-5-cross-encoder")).toThrow(
      "Cross-encoder preview is a labelled forward preview and is not available yet.",
    );
  });
});
