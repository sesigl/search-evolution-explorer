import assert from "node:assert/strict";
import process from "node:process";
import type { WorkbenchState } from "../src/actions/search-workbench.ts";
import type { CodeModuleView } from "../src/domain/code/explain-module.ts";
import type { GradedRanking } from "../src/domain/evaluation/grade-ranking.ts";
import { meta as levelSix } from "../src/domain/levels/level-6-two-tower.ts";
import type { Scorecard } from "../src/domain/types/evaluation.ts";

/** Live acceptance checks: these use the same HTTP routes as the interactive lesson. */
export async function checkChapterSix(baseUrl: string, scorecard: Scorecard): Promise<void> {
  const example = levelSix.guidedExamples[0];
  assert(example, "Chapter 10 must ship a guided example.");
  const query = example.queryText;
  const level = levelSix.id;
  const target = example.assertionTarget;
  assert(target, "The chapter 10 guided example must name a target listing.");
  const previousLevel = "level-5-cross-encoder";
  const params = new URLSearchParams({ q: query, level });
  const [before, after, page, grade, code] = await Promise.all([
    json<WorkbenchState>(
      baseUrl,
      `/api/search.json?q=${encodeURIComponent(query)}&level=${previousLevel}`,
    ),
    json<WorkbenchState>(baseUrl, `/api/search.json?${params}`),
    json<WorkbenchState>(baseUrl, `/api/search.json?${params}&page=2`),
    json<GradedRanking>(baseUrl, `/api/grade.json?${params}`),
    json<CodeModuleView>(baseUrl, "/api/code.json?path=src/domain/levels/level-6-two-tower.ts"),
  ]);
  assert.equal(after.selected?.prerequisiteState, "ready");
  assert(before.view && after.view && page.view);
  assert(!before.view.results.some((row) => row.id === target));
  assert(
    after.view.results.some((row) => row.id === target),
    "The chapter 10 guided example must hold live: the target listing reaches the top 10.",
  );
  assert(
    after.view.results.some((row) =>
      row.signals.some((signal) => signal.name === "learnedRetrievalOnly"),
    ),
    "Trained retrieval must add at least one top-10 row outside chapter 8's shortlist.",
  );
  for (const row of after.view.results) {
    const sum = row.signals.reduce(
      (total, signal) => total + signal.value * (signal.weight ?? 0),
      0,
    );
    assert(Math.abs(sum - row.score) < 1e-10, `Displayed score does not reconstruct for ${row.id}`);
  }
  assert.equal(page.view.results[0]?.position, 11);
  assert(
    !page.view.results.some((row) => after.view?.results.some((first) => row.id === first.id)),
  );
  assert.deepEqual(
    grade.rows.map((row) => row.itemId),
    after.view.results.map((row) => row.id),
  );
  assert.equal(
    grade.ndcgAt10,
    scorecard.runs
      .find((run) => run.levelId === level)
      ?.perQuery.find((row) => row.queryText === query)?.ndcgAt10,
  );
  assert(code.notes.length >= 3);
  assert(code.calls.some((call) => call.symbol === "combineTowerScores"));
  process.stdout.write(
    "Chapter 9 live checks passed: guided example, score sums, pagination, grading and annotated source.\n",
  );
}

async function json<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl));
  assert(response.ok, `${path} returned ${response.status}`);
  return response.json();
}
