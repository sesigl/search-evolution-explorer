import { describe, expect, it } from "vitest";
import { hashContent, resolvePrerequisiteState } from "./manifest.ts";

describe("artifact manifest", () => {
  it("Given the same input, When it is hashed, Then the digest is identical", () => {
    expect(hashContent("corpus")).toBe(hashContent("corpus"));
  });

  it("Given different input, When it is hashed, Then the digest changes", () => {
    expect(hashContent("corpus-a")).not.toBe(hashContent("corpus-b"));
  });

  it("Given a missing artifact, When prerequisite state is resolved, Then the state is missing", () => {
    expect(resolvePrerequisiteState(false, "abc", "abc")).toBe("missing");
  });

  it("Given a hash that no longer matches, When prerequisite state is resolved, Then the state is stale", () => {
    expect(resolvePrerequisiteState(true, "old", "new")).toBe("stale");
  });

  it("Given a matching hash, When prerequisite state is resolved, Then the state is ready", () => {
    expect(resolvePrerequisiteState(true, "same", "same")).toBe("ready");
  });
});
