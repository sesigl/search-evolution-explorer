import type { CorpusItem } from "../types/corpus.ts";
import { positionDecay } from "./position-decay.ts";
import { createRng } from "./rng.ts";

export interface SimulatedSession {
  readonly sessionId: string;
  readonly queryText: string;
  readonly shownItemIds: readonly string[];
  readonly clickedItemIds: readonly string[];
}

export interface SessionSamplerInput {
  readonly queries: readonly string[];
  readonly shownByQuery: ReadonlyMap<string, readonly CorpusItem[]>;
  /**
   * Probability in [0,1] that a searcher finds the listing relevant, before position
   * decay. The shipped simulator derives it from the WANDS grades; a test can pass
   * any function.
   */
  readonly relevanceFor: (queryText: string, itemId: string) => number;
  readonly sessionCount: number;
  readonly seed: number;
}

export function sampleSessions(input: SessionSamplerInput): SimulatedSession[] {
  const rng = createRng(input.seed);
  const sessions: SimulatedSession[] = [];
  const queryCount = input.queries.length;
  if (queryCount === 0 || input.sessionCount <= 0) {
    return sessions;
  }
  const idsByQuery = new Map<string, readonly string[]>();
  for (let index = 0; index < input.sessionCount; index += 1) {
    const queryText = input.queries[index % queryCount];
    if (queryText === undefined) {
      break;
    }
    const shown = input.shownByQuery.get(queryText) ?? [];
    let shownItemIds = idsByQuery.get(queryText);
    if (shownItemIds === undefined) {
      shownItemIds = shown.map((item) => item.id);
      idsByQuery.set(queryText, shownItemIds);
    }
    const clickedItemIds: string[] = [];
    for (const [offset, item] of shown.entries()) {
      const relevance = input.relevanceFor(queryText, item.id);
      if (rng() < relevance * positionDecay(offset + 1)) {
        clickedItemIds.push(item.id);
      }
    }
    sessions.push({
      sessionId: `session-${index + 1}`,
      queryText,
      shownItemIds,
      clickedItemIds,
    });
  }
  return sessions;
}
