import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenize.ts";

describe("tokenisation", () => {
  it("Given mixed-case query text, When it is tokenised, Then lowercase alphanumeric tokens are returned", () => {
    expect(tokenize("iPhone 13")).toEqual(["iphone", "13"]);
  });

  it("Given empty text, When it is tokenised, Then no tokens are returned", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("Given punctuation, When the text is tokenised, Then separators are dropped", () => {
    expect(tokenize("e-bike, ultra!")).toEqual(["e", "bike", "ultra"]);
  });
});
