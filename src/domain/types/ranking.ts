import type { CorpusItem } from "./corpus.ts";

export interface RetrievalSignal {
  readonly name: string;
  readonly value: number;
  readonly explanation: string;
  /**
   * Multiplier applied to this signal when the score is built, when the level uses weights.
   * Hand-picked in chapter 6, learned from clicks in chapter 7. Absent for a signal that is
   * a score of its own (BM25, the fused rank) or an intercept.
   */
  readonly weight?: number | undefined;
}

export interface CandidateSet {
  readonly items: readonly CorpusItem[];
}

export interface ScoredCandidate {
  readonly item: CorpusItem;
  readonly score: number;
  readonly signals: readonly RetrievalSignal[];
}

export interface RankedResult {
  readonly item: CorpusItem;
  readonly position: number;
  readonly score: number;
  readonly signals: readonly RetrievalSignal[];
}
