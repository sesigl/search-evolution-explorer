import { describe, expect, it } from "vitest";
import type { EvolutionLevel } from "../types/level.ts";
import { levels } from "./level-registry.ts";
import { readyLevels } from "./ready-levels.ts";

function level(id: string, ordinal: number, implemented: boolean): EvolutionLevel {
  return { ...(levels[0] as EvolutionLevel), id, ordinal, implemented };
}

describe("ready levels", () => {
  it("keeps the evaluation introduction and every implemented level that has a ranker, in ladder order", () => {
    const ordered = readyLevels(
      [level("b", 2, true), level("a", 0, true), level("nope", 3, false), level("c", 3, true)],
      (id) => id !== "b",
    );
    expect(ordered.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  it("drops an implemented level whose ranker is unavailable, even above the introduction", () => {
    expect(
      readyLevels([level("a", 0, true), level("b", 1, true)], () => false).map((e) => e.id),
    ).toEqual(["a"]);
  });
});
