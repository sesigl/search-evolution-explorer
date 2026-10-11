import { describe, expect, it } from "vitest";
import { queryIntentFor } from "./query-intent.ts";

/**
 * Every declared meaning. The answer key grades against one meaning per query; this test pins
 * that meaning so a silent edit to the table cannot change how a query is read.
 */
const DECLARED_INTENTS: readonly (readonly [string, string])[] = [
  [
    "marble",
    "the stone marble as a material. A table, tile, sink or decor piece made of or patterned like marble is relevant; an unrelated item that only shares the word is not",
  ],
  [
    "industrial",
    "the industrial style, not a factory. Furniture, lighting and decor in that style are relevant; a literal industrial part is not",
  ],
  [
    "mid century modern",
    "the mid-century modern style across furniture and decor; a single word in common is not enough",
  ],
  ["turquoise pillows", "decorative pillows in turquoise or teal"],
];

describe("query intent", () => {
  it.each(DECLARED_INTENTS)("declares the meaning of %s", (query, intent) => {
    expect(queryIntentFor(query)).toBe(intent);
  });

  it("normalises case and surrounding space before the lookup", () => {
    expect(queryIntentFor("  MARBLE  ")).toBe(queryIntentFor("marble"));
  });

  it("has no declared meaning for an unambiguous query", () => {
    expect(queryIntentFor("area rug")).toBeNull();
  });
});
