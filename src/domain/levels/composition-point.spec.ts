import { describe, expect, it } from "vitest";
import { findCompositionPoint } from "./composition-point.ts";

describe("composition point detection", () => {
  it("Given a baseline level that does not wrap another level, When the composition point is detected, Then both fields are null", () => {
    const source = [
      "export function createRanker(_deps: LevelDeps): LevelRanker {",
      "  return { match() { return { items: [] }; }, score(_u, c) { return { item: c, score: 0, signals: [] }; } };",
      "}",
    ].join("\n");

    expect(findCompositionPoint(source)).toEqual({
      composesLevelId: null,
      compositionPointLine: null,
    });
  });

  it("Given a level that wraps the level below, When the composition point is detected, Then the previous level id and wrap line are reported", () => {
    const source = [
      'import { createRanker as createPrevious } from "./level-1-lexical.ts";',
      "",
      "export function createRanker(deps: LevelDeps): LevelRanker {",
      "  const previous = createPrevious(deps);",
      "  return { match: previous.match, score: previous.score };",
      "}",
    ].join("\n");

    expect(findCompositionPoint(source)).toEqual({
      composesLevelId: "level-1-lexical",
      compositionPointLine: 4,
    });
  });

  it("Given a scoring-only wrap, When the composition point is detected, Then the line that calls the previous score is not required if the factory wrap is present", () => {
    const source = [
      'import { createRanker as createPrevious } from "./level-2-boosting.ts";',
      "export function createRanker(deps: LevelDeps): LevelRanker {",
      "  const previous = createPrevious(deps);",
      "  return { match: previous.match, score(u, c) { return previous.score(u, c); } };",
      "}",
    ].join("\n");

    expect(findCompositionPoint(source).composesLevelId).toBe("level-2-boosting");
    expect(findCompositionPoint(source).compositionPointLine).toBe(3);
  });
});
