import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIAS_TOUR, CODE_TOUR, SEARCH_TOUR, tourNamed } from "./tours.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

/** Every `data-tour="…"` anchor declared in the UI. */
function declaredAnchors(): Set<string> {
  const anchors = new Set<string>();
  for (const file of [
    ...sourceFiles("src/islands"),
    ...sourceFiles("src/pages"),
    ...sourceFiles("src/components"),
  ]) {
    for (const match of readFileSync(file, "utf8").matchAll(/data-tour="([a-z-]+)"/g)) {
      anchors.add(match[1] ?? "");
    }
  }
  return anchors;
}

describe("tours", () => {
  it("point only at anchors that exist in the UI", () => {
    const anchors = declaredAnchors();
    for (const tour of [SEARCH_TOUR, CODE_TOUR, BIAS_TOUR]) {
      for (const step of tour.steps) {
        if (step.target !== null) {
          expect(anchors, `${tour.name}: ${step.target}`).toContain(step.target);
        }
      }
    }
  });

  it("open with a centred welcome and keep every step short", () => {
    for (const tour of [SEARCH_TOUR, CODE_TOUR, BIAS_TOUR]) {
      expect(tour.steps[0]?.target).toBeNull();
      for (const step of tour.steps) {
        expect(step.text.length, `${tour.name}: ${step.title}`).toBeLessThan(420);
      }
    }
  });

  it("runs the failing query before the switch that fixes it", () => {
    const actions = SEARCH_TOUR.steps.flatMap((step) => (step.action ? [step.action.run] : []));
    expect(actions.map((run) => run.levers.synonyms)).toEqual([false, true]);
    expect(tourNamed("code")).toBe(CODE_TOUR);
    expect(tourNamed("bias")).toBe(BIAS_TOUR);
    expect(tourNamed("nope")).toBeUndefined();
  });
});
