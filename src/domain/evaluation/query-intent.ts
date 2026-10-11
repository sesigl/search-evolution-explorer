/**
 * What the searcher means by a test query, when the words alone are ambiguous.
 *
 * "marble" can name the stone, a tile pattern or a decor finish. A ranked list cannot be
 * graded against every meaning at once, so the answer key fixes one meaning per query and
 * states it. This map is authored by hand and is deliberately independent of the app's own
 * query understanding: grading a ranker with the ranker's own guess would prove nothing.
 *
 * Shown to the reader wherever a single query is graded, so the meaning is never hidden.
 */
const QUERY_INTENT: ReadonlyMap<string, string> = new Map([
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
]);

/** The declared meaning of a test query, or null when the words are unambiguous. */
export function queryIntentFor(queryText: string): string | null {
  return QUERY_INTENT.get(queryText.trim().toLowerCase()) ?? null;
}
