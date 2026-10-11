import assert from "node:assert/strict";
import process from "node:process";
import type { WorkbenchState } from "../src/actions/search-workbench.ts";
import { evaluateGuidedExample } from "../src/domain/levels/guided-example.ts";
import { levels } from "../src/domain/levels/level-registry.ts";

/**
 * Live acceptance checks for every implemented chapter's guided example, over the same HTTP
 * routes the lesson uses. `check:examples` only proves an example exists; this proves the
 * claimed behaviour still happens on the current corpus and artifacts.
 */
export async function checkGuidedExamples(baseUrl: string): Promise<void> {
  const implemented = levels
    .filter((level) => level.implemented && level.ordinal > 0 && level.guidedExamples.length > 0)
    .sort((left, right) => left.ordinal - right.ordinal);
  let checked = 0;
  for (const level of implemented) {
    const previousLevel = levels.find((entry) => entry.ordinal === level.ordinal - 1);
    for (const example of level.guidedExamples) {
      const params = new URLSearchParams({ q: example.queryText, level: level.id });
      const current = await json<WorkbenchState>(baseUrl, `/api/search.json?${params}`);
      const previous =
        previousLevel === undefined
          ? null
          : await json<WorkbenchState>(
              baseUrl,
              `/api/search.json?q=${encodeURIComponent(example.queryText)}&level=${previousLevel.id}`,
            );
      assert(current.view, `${level.id} must return a view for its guided example.`);
      const currentRows = current.view.results.map((row) => ({ item: { id: row.id } }));
      const previousRows = (previous?.view?.results ?? []).map((row) => ({ item: { id: row.id } }));
      assert(
        evaluateGuidedExample(
          example.assertion,
          example.assertionTarget,
          currentRows,
          previousRows,
        ),
        `Guided example no longer holds: ${level.id} / “${example.queryText}” (${example.assertion} → ${example.assertionTarget ?? "any order change"}).`,
      );
      checked += 1;
    }
  }
  process.stdout.write(`Guided-example live checks passed: ${checked} examples.\n`);
}

async function json<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl));
  assert(response.ok, `${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}
