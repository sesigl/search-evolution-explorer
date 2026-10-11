export interface Judgment {
  readonly queryText: string;
  readonly itemId: string;
  readonly grade: 0 | 1 | 2 | 3;
}

export interface ScorecardQueryRow {
  readonly queryText: string;
  readonly ndcgAt10: number;
  readonly deltaVsPreviousLevel: number;
}

export interface ScorecardRun {
  readonly levelId: string;
  readonly ndcgAt10: number;
  readonly mrr: number;
  readonly recallAt50: number;
  readonly msPerQueryP50: number;
  readonly msPerQueryP95: number;
  readonly perQuery: readonly ScorecardQueryRow[];
  readonly groundTruthDisclosure: string;
}

export interface ScorecardRegression {
  readonly levelId: string;
  readonly queryText: string;
  readonly delta: number;
}

export interface Scorecard {
  readonly runs: readonly ScorecardRun[];
  readonly regressions: readonly ScorecardRegression[];
  /** Present when Chapter 10's fixed query split is available. */
  readonly heldOut?: Scorecard;
}
