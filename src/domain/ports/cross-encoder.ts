/** Scores the query and each document jointly. Scores follow the document order. */
export interface CrossEncoder {
  scorePairs(query: string, documents: readonly string[]): Promise<readonly number[]>;
}
