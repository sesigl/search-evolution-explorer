import { itemText } from "../text/item-text.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { Analyzer, InvertedIndex } from "../types/level.ts";
import type { CandidateSet } from "../types/ranking.ts";

export function buildInvertedIndex(items: readonly CorpusItem[], analyze: Analyzer): InvertedIndex {
  const postings = new Map<string, Set<string>>();
  const byId = new Map<string, CorpusItem>();
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;
  let documentCount = 0;
  for (const item of items) {
    if (item.available) {
      byId.set(item.id, item);
      const tokens = analyze(itemText(item));
      documentCount += 1;
      totalLength += tokens.length;
      const unique = new Set(tokens);
      for (const token of unique) {
        let posting = postings.get(token);
        if (posting === undefined) {
          posting = new Set<string>();
          postings.set(token, posting);
        }
        posting.add(item.id);
      }
    }
  }
  for (const [token, posting] of postings) {
    documentFrequency.set(token, posting.size);
  }
  return {
    documentCount,
    averageLength: documentCount === 0 ? 1 : totalLength / documentCount,
    documentFrequency,
    availableItems: [...byId.values()],
    match(queryTokens: readonly string[]): CandidateSet {
      if (queryTokens.length === 0) {
        return { items: [] };
      }
      let ids: Set<string> | undefined;
      for (const token of queryTokens) {
        const posting = postings.get(token) ?? new Set<string>();
        ids = ids === undefined ? new Set(posting) : intersect(ids, posting);
      }
      return { items: itemsFromIds(ids, byId) };
    },
  };
}

export function matchTermGroups(
  index: InvertedIndex,
  groups: readonly (readonly string[])[],
): CandidateSet {
  if (groups.length === 0) {
    return { items: [] };
  }
  let ids: Set<string> | undefined;
  const byId = new Map<string, CorpusItem>();
  for (const group of groups) {
    const unionIds = new Set<string>();
    for (const token of group) {
      for (const item of index.match([token]).items) {
        unionIds.add(item.id);
        byId.set(item.id, item);
      }
    }
    ids = ids === undefined ? unionIds : intersect(ids, unionIds);
  }
  return { items: itemsFromIds(ids, byId) };
}

function itemsFromIds(
  ids: Set<string> | undefined,
  byId: ReadonlyMap<string, CorpusItem>,
): CorpusItem[] {
  const matched: CorpusItem[] = [];
  for (const id of ids ?? []) {
    const item = byId.get(id);
    if (item !== undefined) {
      matched.push(item);
    }
  }
  return matched;
}

function intersect(left: Set<string>, right: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of left) {
    if (right.has(id)) {
      result.add(id);
    }
  }
  return result;
}
