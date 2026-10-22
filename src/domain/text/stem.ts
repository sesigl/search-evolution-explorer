import { stemmer } from "stemmer";

// Indexing stems about four million words, but only some fifty thousand distinct ones.
// Remembering each answer turns that start-up cost into a lookup. Bounded for odd queries.
const MAX_REMEMBERED = 200_000;
const stems = new Map<string, string>();

export function stem(token: string): string {
  const known = stems.get(token);
  if (known !== undefined) {
    return known;
  }
  const stemmed = stemmer(token);
  if (stems.size < MAX_REMEMBERED) {
    stems.set(token, stemmed);
  }
  return stemmed;
}
