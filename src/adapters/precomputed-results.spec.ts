import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPrecomputedResults, selectPrecomputedResults } from "./precomputed-results.ts";

describe("precomputed results", () => {
  it("Given a missing results file, When it is read, Then the result is absent", () => {
    expect(readPrecomputedResults(join(tmpdir(), "missing-results.json"))).toBeUndefined();
  });

  it("Given a results file without scorecard runs, When it is read, Then the file is rejected", () => {
    const directory = mkdtempSync(join(tmpdir(), "results-"));
    const path = join(directory, "results.json");
    writeFileSync(path, JSON.stringify({ fingerprint: "f", fullScorecard: {}, biasLesson: {} }));
    expect(() => readPrecomputedResults(path)).toThrow(/malformed/i);
  });

  it("refuses missing or stale production reports instead of running a live evaluation", () => {
    const saved = readPrecomputedResults("data/precomputed/results.json");
    expect(() => selectPrecomputedResults(undefined, () => "anything", false)).toThrow(
      /Run npm run data:precompute/,
    );
    expect(() => selectPrecomputedResults(saved, () => "changed-code", false)).toThrow(
      /Run npm run data:precompute/,
    );
  });
});
