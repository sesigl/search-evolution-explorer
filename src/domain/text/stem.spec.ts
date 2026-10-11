import { describe, expect, it } from "vitest";
import { stem } from "./stem.ts";

describe("stemming", () => {
  it("Given a plural token, When it is stemmed, Then the Porter stem is returned", () => {
    expect(stem("listings")).toBe("list");
  });
});
