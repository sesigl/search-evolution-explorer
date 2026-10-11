import { describe, expect, it } from "vitest";
import { normalizeVariants } from "./normalize-variants.ts";

describe("variant normalisation", () => {
  it("Given split hyphen tokens, When variants are normalised, Then they collapse to the canonical form", () => {
    expect(normalizeVariants(["e", "bike"], [{ pattern: "e bike", canonical: "ebike" }])).toEqual([
      "ebike",
    ]);
  });
});
