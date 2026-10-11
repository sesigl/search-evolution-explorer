import { describe, expect, it } from "vitest";
import { currentInputHash, stateForPath } from "./artifact-state.ts";

describe("artifact prerequisite state", () => {
  it("Given embeddings on disk and no encoder, When state is resolved, Then the artifact is missing", () => {
    expect(stateForPath("data/embeddings.bin", false, "abc", "")).toBe("missing");
  });

  it("Given a path that does not exist, When state is resolved, Then the artifact is missing", () => {
    expect(stateForPath("data/does-not-exist.json", true, "abc", "")).toBe("missing");
  });

  it("Given a missing file, When its input hash is requested, Then the hash is empty", () => {
    expect(currentInputHash("data/does-not-exist.ndjson")).toBe("");
  });

  it("Given the committed corpus, When its input hash is requested, Then the hash is not empty", () => {
    expect(currentInputHash("data/corpus.ndjson").length).toBeGreaterThan(0);
  });

  it("Given a model whose click log hash no longer matches, When state is resolved, Then the artifact is stale", () => {
    expect(stateForPath("data/models/ranker-corrected.json", true, "unused", "wrong")).toBe(
      "stale",
    );
  });
});
