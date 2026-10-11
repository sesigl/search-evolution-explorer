import { describe, expect, it } from "vitest";
import {
  bestCorrection,
  buildVocabulary,
  correctTokens,
  levenshtein,
  splitCompound,
} from "./spell-correction.ts";

const vocabulary = buildVocabulary([
  "Apple iPhone 13 unlocked",
  "VW Golf 4 cabriolet",
  "Blue bicycle with basket",
  "Black sofa, barely used",
  "USB cable 2m",
]);

describe("spell correction", () => {
  it("Given two words, When the distance is measured, Then insertions and substitutions cost 1", () => {
    expect(levenshtein("iphone", "iphne")).toBe(1);
    expect(levenshtein("iphone", "iphone")).toBe(0);
    expect(levenshtein("", "sofa")).toBe(4);
    expect(levenshtein("sofa", "")).toBe(4);
  });

  it("Given listing texts, When the vocabulary is built, Then it holds raw words and digits but no stems or short words", () => {
    expect(vocabulary.has("iphone")).toBe(true);
    expect(vocabulary.has("13")).toBe(true);
    expect(vocabulary.has("2m")).toBe(true);
    expect(vocabulary.has("a")).toBe(false);
    expect(vocabulary.has("of")).toBe(false);
  });

  it("Given a one-letter typo, When a unique neighbour exists, Then it is suggested", () => {
    expect(bestCorrection("iphne", vocabulary)).toBe("iphone");
    expect(bestCorrection("bycycle", vocabulary)).toBe("bicycle");
    expect(bestCorrection("sofah", vocabulary)).toBe("sofa");
  });

  it("Given a known word, When a correction is asked for, Then nothing is suggested", () => {
    expect(bestCorrection("iphone", vocabulary)).toBe(null);
  });

  it("Given a plural, When its stem is known, Then no correction is suggested", () => {
    expect(bestCorrection("jackets", buildVocabulary(["Black jacket"]))).toBe(null);
    expect(bestCorrection("bikes", buildVocabulary(["Blue bike"]))).toBe(null);
  });

  it("Given a rare word, When only one listing holds it, Then it cannot rewrite a query", () => {
    const rare = buildVocabulary(["Viking helmet"], 2);
    expect(rare.has("viking")).toBe(false);
    const established = buildVocabulary(["Viking helmet", "Viking ship"], 2);
    expect(established.has("viking")).toBe(true);
  });

  it("Given a word without a digit, When the closest word is a model number, Then nothing is suggested", () => {
    expect(bestCorrection("vw", new Set(["v1", "vw2", "golf"]))).toBe(null);
    expect(bestCorrection("v1", new Set(["v1", "v2"]))).toBe(null);
  });

  it("Given two words at the same distance, When a correction is asked for, Then nothing is suggested", () => {
    const tied = new Set(["abc", "abd"]);
    expect(bestCorrection("abe", tied)).toBe(null);
  });

  it("Given an inflectional tie, When every candidate is one word, Then the base form wins", () => {
    const words = new Set(["sofa", "sofas"]);
    expect(bestCorrection("sofah", words)).toBe("sofa");
  });

  it("Given a far misspelling, When a correction is asked for, Then nothing is suggested", () => {
    expect(bestCorrection("xyzzy", vocabulary)).toBe(null);
  });

  it("Given a compound word, When both parts are known, Then it splits into two tokens", () => {
    expect(splitCompound("iphonecase", buildVocabulary(["iPhone case"]))).toEqual([
      "iphone",
      "case",
    ]);
    expect(splitCompound("iphone13", vocabulary)).toEqual(["iphone", "13"]);
    expect(splitCompound("iphone", vocabulary)).toBe(null);
    expect(splitCompound("xyzzy", vocabulary)).toBe(null);
  });

  it("Given query tokens, When they are corrected, Then each fix is reported with its source", () => {
    const result = correctTokens(["iphne", "cable", "xyzzy"], vocabulary);
    expect(result.corrected).toEqual(["iphone", "cable", "xyzzy"]);
    expect(result.corrections).toEqual([{ from: "iphne", to: "iphone" }]);
  });

  it("Given a compound token, When it is corrected, Then both parts enter the corrected tokens", () => {
    const words = buildVocabulary(["iPhone case"]);
    const result = correctTokens(["iphonecase"], words);
    expect(result.corrected).toEqual(["iphone", "case"]);
    expect(result.corrections).toEqual([{ from: "iphonecase", to: "iphone case" }]);
  });
});
