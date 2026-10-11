import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPrecomputedResults } from "./precomputed-results.ts";

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
});
