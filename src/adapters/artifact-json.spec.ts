import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readJudgments, readModel } from "./artifact-json.ts";

describe("artifact json", () => {
  it("Given a model file that is not a trained ranker, When it is read, Then the file is rejected", () => {
    const directory = mkdtempSync(join(tmpdir(), "model-"));
    const path = join(directory, "ranker.json");
    writeFileSync(path, JSON.stringify({ variant: "nope" }));
    expect(() => readModel(path)).toThrow(/malformed/i);
  });

  it("Given an NDJSON line that is not a judgment, When judgments are read, Then the file is rejected", () => {
    const directory = mkdtempSync(join(tmpdir(), "judgments-"));
    const path = join(directory, "judgments.ndjson");
    writeFileSync(path, `${JSON.stringify({ queryText: "q" })}\n`);
    expect(() => readJudgments(path)).toThrow(/malformed/i);
  });

  it("Given a missing model file, When it is read, Then the result is absent", () => {
    expect(readModel(join(tmpdir(), "missing-ranker.json"))).toBeUndefined();
  });
});
