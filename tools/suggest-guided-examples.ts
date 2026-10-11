/**
 * Suggest guided examples for each chapter from the live pipeline.
 *
 * The planted corpus is gone, so every chapter's guided example must be re-pointed to a real
 * WANDS query. This tool asks the running app for the current and previous chapter rankings
 * over a curated query per chapter and reports the first query where the chapter visibly
 * differs, with the contrasting listing titles, so the prose can be written from the result.
 *
 * Run (with the app running): node tools/suggest-guided-examples.ts [baseUrl]
 */
import process from "node:process";
import type { WorkbenchState } from "../src/actions/search-workbench.ts";
import { levels } from "../src/domain/levels/level-registry.ts";

const baseUrl = process.argv[2] ?? "http://localhost:4330";

/** Curated WANDS queries per chapter, in preference order. */
const CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  "level-1-recency": ["sofa", "couch", "area rug"],
  "level-1-normalization": ["carpet", "mid century modern", "couch"],
  "level-1-lexical": ["sofa", "couch", "area rug"],
  "level-1-spelling": ["ligth bulb", "biycicle plant stands", "pedistole sink"],
  "level-1-entities": ["turquoise pillows", "black 5 drawer dresser by guilford", "kohler sink"],
  "level-1-canonical": ["area rug", "curtain rod", "queen mattress"],
  "level-2-boosting": ["marble", "table lamp", "area rug"],
  "level-3-learned": ["marble", "table lamp", "area rug"],
  "level-4-hybrid": ["couch", "table lamp", "sofa"],
  "level-5-cross-encoder": ["table lamp", "area rug", "lamp"],
  "level-6-two-tower": ["area rug", "table lamp", "turquoise pillows"],
};

interface Suggestion {
  readonly levelId: string;
  readonly queryText: string;
  readonly assertion: "itemEnters" | "itemExits" | "rankChangeInTop10";
  readonly target: string | null;
  readonly targetTitle: string;
  readonly currentTitles: readonly string[];
  readonly previousTitles: readonly string[];
}

interface View {
  readonly ids: readonly string[];
  readonly titles: readonly string[];
}

async function fetchView(levelId: string, queryText: string): Promise<View> {
  const params = new URLSearchParams({ q: queryText, level: levelId });
  const response = await fetch(new URL(`/api/search.json?${params}`, baseUrl));
  if (!response.ok) {
    return { ids: [], titles: [] };
  }
  const state = (await response.json()) as WorkbenchState;
  const results = state.view?.results ?? [];
  return {
    ids: results.map((row) => row.id),
    titles: results.map((row) => row.title ?? row.id),
  };
}

function titleOf(view: View, id: string): string {
  const index = view.ids.indexOf(id);
  return index === -1 ? id : (view.titles[index] ?? id);
}

function pick(
  levelId: string,
  queryText: string,
  current: View,
  previous: View,
): Suggestion | null {
  const entered = current.ids.find((id) => !previous.ids.includes(id));
  if (entered !== undefined) {
    return build(levelId, queryText, "itemEnters", entered, current, previous);
  }
  const moved = current.ids.find(
    (id, index) => previous.ids.includes(id) && previous.ids.indexOf(id) !== index,
  );
  if (moved !== undefined) {
    return build(levelId, queryText, "rankChangeInTop10", moved, current, previous);
  }
  const exited = previous.ids.find((id) => !current.ids.includes(id));
  if (exited !== undefined) {
    return build(levelId, queryText, "itemExits", exited, current, previous);
  }
  return null;
}

function build(
  levelId: string,
  queryText: string,
  assertion: Suggestion["assertion"],
  target: string,
  current: View,
  previous: View,
): Suggestion {
  return {
    levelId,
    queryText,
    assertion,
    target,
    targetTitle: titleOf(current, target) || titleOf(previous, target),
    currentTitles: current.titles,
    previousTitles: previous.titles,
  };
}

const suggestions: Suggestion[] = [];
for (const level of levels
  .filter((entry) => entry.implemented && entry.ordinal > 0)
  .sort((left, right) => left.ordinal - right.ordinal)) {
  const previousLevel = levels.find((entry) => entry.ordinal === level.ordinal - 1);
  if (previousLevel === undefined) {
    continue;
  }
  const candidates = CANDIDATES[level.id] ?? ["area rug"];
  for (const queryText of candidates) {
    const current = await fetchView(level.id, queryText);
    const previous = await fetchView(previousLevel.id, queryText);
    const suggestion = pick(level.id, queryText, current, previous);
    if (suggestion !== null) {
      suggestions.push(suggestion);
      break;
    }
  }
}

process.stdout.write(`${JSON.stringify(suggestions, null, 2)}\n`);
