import { describe, expect, it } from "vitest";
import { explainModule } from "../domain/code/explain-module.ts";
import { listModulePaths, readModuleSource } from "../domain/code/module-registry.ts";
import { levels } from "../domain/levels/level-registry.ts";
import { annotatedModulePaths, codeNotesFor } from "./code-notes.ts";

describe("code notes", () => {
  const known = listModulePaths();

  it("Given every annotated module, When its notes are placed, Then each note matches exactly one line of the real source", () => {
    for (const path of annotatedModulePaths()) {
      expect(known.has(path), `${path} is not a domain module`).toBe(true);
      const view = explainModule(path, readModuleSource(path), codeNotesFor(path), known);
      expect(view.notes.length).toBe(codeNotesFor(path)?.notes.length ?? -1);
    }
  });

  it("Given every implemented level, When explained, Then it has notes and every function it imports from the domain is openable", () => {
    for (const level of levels.filter((entry) => entry.implemented && entry.ordinal > 0)) {
      const path = level.sourceSpecifier;
      expect(known.has(path), `${path} is not a domain module`).toBe(true);
      const view = explainModule(path, readModuleSource(path), codeNotesFor(path), known);
      expect(view.notes.length).toBeGreaterThan(2);
      expect(view.calls.length).toBeGreaterThan(0);
      for (const call of view.calls) {
        const target = explainModule(call.path, readModuleSource(call.path), undefined, known);
        expect(
          target.definitions.some((definition) => definition.symbol === call.symbol),
          `${call.symbol} is not defined in ${call.path}`,
        ).toBe(true);
      }
    }
  });
});
