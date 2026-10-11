import type { Clock } from "../ports/clock.ts";
import type { CorpusSource } from "../ports/corpus-source.ts";
import type { CrossEncoder } from "../ports/cross-encoder.ts";
import type { QueryEncoder } from "../ports/query-encoder.ts";
import type { VectorStore } from "../ports/vector-store.ts";
import type { EntityConcept } from "../query-understanding/entities.ts";
import type { CorpusItem } from "./corpus.ts";
import type { LeverConfiguration, QueryUnderstanding, SpellingCorrection } from "./query.ts";
import type { CandidateSet, ScoredCandidate } from "./ranking.ts";

type LevelChange = "matching" | "scoring" | "both";
type PrerequisiteKind = "index" | "embeddings" | "model" | "judgments" | "clicks";
export type PrerequisiteState = "ready" | "missing" | "stale";
type GuidedExampleAssertion = "rankChangeInTop10" | "itemEnters" | "itemExits";

interface Prerequisite {
  readonly kind: PrerequisiteKind;
  readonly artifactPath: string;
  readonly buildCommand: string;
}

interface GuidedExample {
  readonly queryText: string;
  readonly expectedDifference: string;
  readonly assertion: GuidedExampleAssertion;
  readonly assertionTarget: string | null;
}

export interface EvolutionLevel {
  readonly id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly capability: string;
  readonly changes: LevelChange;
  readonly mechanism: string;
  readonly tradeOff: string;
  readonly fixesFailureMode: string | null;
  readonly prerequisites: readonly Prerequisite[];
  readonly sourceSpecifier: string;
  readonly implemented: boolean;
  readonly guidedExamples: readonly GuidedExample[];
  readonly candidateWidth: number;
}

export type Analyzer = (text: string) => string[];

export interface InvertedIndex {
  match(tokens: readonly string[]): CandidateSet;
  readonly documentCount: number;
  readonly averageLength: number;
  readonly documentFrequency: ReadonlyMap<string, number>;
  readonly availableItems: readonly CorpusItem[];
}

export interface EvolutionLevelSummary {
  readonly id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly capability: string;
  readonly changes: LevelChange;
  readonly mechanism: string;
  readonly tradeOff: string;
  readonly fixesFailureMode: string | null;
}

export interface TrainedRankingModel {
  readonly variant: "naive" | "corrected";
  readonly featureNames: readonly string[];
  readonly weights: readonly number[];
  readonly bias: number;
}

export interface LevelDeps {
  readonly corpus: CorpusSource;
  readonly index: InvertedIndex;
  readonly levers: LeverConfiguration;
  readonly clock: Clock;
  readonly queryEncoder?: QueryEncoder;
  readonly vectorStore?: VectorStore;
  readonly model?: TrainedRankingModel;
}

export interface LevelRanker {
  match(understanding: QueryUnderstanding): CandidateSet;
  score(understanding: QueryUnderstanding, candidate: CorpusItem): ScoredCandidate;
  /** Vocabulary corrections this level applied; empty when the level looks words up as typed. */
  correctionsFor?(understanding: QueryUnderstanding): readonly SpellingCorrection[];
  /** Ontology concepts this level enforced; empty when the level uses words only. */
  conceptsFor?(understanding: QueryUnderstanding): readonly EntityConcept[];
}

/** Joint neural inference is asynchronous; earlier chapters keep synchronous matching. */
export interface AsyncLevelRanker {
  match(understanding: QueryUnderstanding): Promise<CandidateSet>;
  score(understanding: QueryUnderstanding, candidate: CorpusItem): ScoredCandidate;
  /** Vocabulary corrections this level applied; empty when the level looks words up as typed. */
  correctionsFor?(understanding: QueryUnderstanding): readonly SpellingCorrection[];
  /** Ontology concepts this level enforced; empty for word-only levels. */
  conceptsFor?(understanding: QueryUnderstanding): readonly EntityConcept[];
}

export interface CrossEncoderDeps extends LevelDeps {
  readonly crossEncoder: CrossEncoder;
}
