import { describe, expect, it } from "vitest";
import { levels } from "./level-registry.ts";
import { listLevels } from "./list-levels.ts";

const previewReason = /preview/i;

describe("level registry", () => {
  it("Given the registry, When levels are listed, Then they appear in ladder order with contiguous ordinals", () => {
    const ordinals = levels.map((level) => level.ordinal);
    expect(ordinals).toEqual(ordinals.slice().sort((left, right) => left - right));
    expect(ordinals).toEqual(ordinals.map((_, index) => index));
  });

  it("Given the registry, When a learner opens the selector, Then each level has a one-line capability", () => {
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      expect(level.capability.trim().length).toBeGreaterThan(0);
      expect(level.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("Given implemented and preview levels, When the selector is built, Then every level is listed and a preview is marked unavailable", () => {
    const listed = listLevels(
      [
        levels[0] as (typeof levels)[number],
        {
          ...(levels[0] as (typeof levels)[number]),
          id: "level-9-preview",
          ordinal: 9,
          label: "Cross-encoder preview",
          capability: "Forward preview of joint encoding.",
          implemented: false,
        },
      ],
      () => "ready",
    );
    expect(listed.map((level) => level.id)).toEqual(["level-0-evaluation", "level-9-preview"]);
    expect(listed[1]?.implemented).toBe(false);
    expect(listed[1]?.prerequisiteState).toBe("missing");
    expect(listed[1]?.unavailableReason).toMatch(previewReason);
  });

  it("Given a missing model artifact, When levels are listed, Then the learned level is marked missing with a rebuild command", () => {
    const listed = listLevels(levels, (path) => (path.includes("ranker") ? "missing" : "ready"));
    const learned = listed.find((level) => level.id === "level-3-learned");
    expect(learned?.prerequisiteState).toBe("missing");
    expect(learned?.rebuildCommand).toBe("npm run data:train");
  });

  it("Given a stale embedding hash, When levels are listed, Then hybrid is marked stale with a rebuild command", () => {
    const listed = listLevels(levels, (path) => (path.includes("embeddings") ? "stale" : "ready"));
    const hybrid = listed.find((level) => level.id === "level-4-hybrid");
    expect(hybrid?.prerequisiteState).toBe("stale");
    expect(hybrid?.rebuildCommand).toBe("npm run data:embeddings");
  });
});
