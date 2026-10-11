import { describe, expect, it } from "vitest";
import { explainModule } from "./explain-module.ts";
import { listModulePaths, readModuleSource, resolvePath } from "./module-registry.ts";

const KNOWN = new Set([
  "src/domain/levels/level-1-lexical.ts",
  "src/domain/levels/level-0-evaluation.ts",
  "src/domain/index/inverted-index.ts",
]);

const SOURCE = [
  'import { matchTermGroups } from "../index/inverted-index.ts";',
  'import type { LevelDeps } from "../types/level.ts";',
  'import { createRanker as createPrevious } from "./level-0-evaluation.ts";',
  "",
  "const LIMIT = 5;",
  "",
  "export function createRanker(deps: LevelDeps) {",
  "  const previous = createPrevious(deps);",
  "  return helper(deps.index, LIMIT);",
  "}",
  "",
  "function helper(index: unknown, limit: number) {",
  "  return matchTermGroups(index, limit);",
  "}",
  "",
].join("\n");

describe("explainModule", () => {
  it("Given an aliased import, When the alias is used, Then the span links to the exported symbol in the resolved module", () => {
    const view = explainModule("src/domain/levels/level-1-lexical.ts", SOURCE, undefined, KNOWN);
    const line8 = view.lines[7];
    const link = line8?.spans.find((span) => span.link !== null)?.link;

    expect(link).toEqual({
      path: "src/domain/levels/level-0-evaluation.ts",
      symbol: "createRanker",
      kind: "module",
    });
  });

  it("Given a local function and constant, When they are used, Then the uses link locally and the definition lines do not link themselves", () => {
    const view = explainModule("src/domain/levels/level-1-lexical.ts", SOURCE, undefined, KNOWN);
    const line9 = view.lines[8];
    const line12 = view.lines[11];

    expect(line9?.spans.map((span) => span.link?.symbol ?? null)).toEqual([
      null,
      "helper",
      null,
      "LIMIT",
      null,
    ]);
    expect(line12?.spans.every((span) => span.link === null)).toBe(true);
    expect(view.definitions).toEqual([
      { symbol: "LIMIT", startLine: 5, endLine: 5 },
      { symbol: "createRanker", startLine: 7, endLine: 10 },
      { symbol: "helper", startLine: 12, endLine: 14 },
    ]);
  });

  it("Given type-only imports and unknown modules, When imports are parsed, Then neither is linked and calls list first uses only", () => {
    const view = explainModule("src/domain/levels/level-1-lexical.ts", SOURCE, undefined, KNOWN);

    expect(view.lines[1]?.spans.every((span) => span.link === null)).toBe(true);
    expect(view.calls).toEqual([
      {
        symbol: "createRanker",
        path: "src/domain/levels/level-0-evaluation.ts",
        fileName: "level-0-evaluation.ts",
        line: 8,
      },
      {
        symbol: "matchTermGroups",
        path: "src/domain/index/inverted-index.ts",
        fileName: "inverted-index.ts",
        line: 13,
      },
    ]);
  });

  it("Given notes, When each matches one line, Then they are numbered in line order; an ambiguous note is rejected", () => {
    const notes = {
      summary: "A test module.",
      notes: [
        { at: "return helper(", title: "Second", text: "b" },
        { at: "const previous", title: "First", text: "a" },
      ],
    };
    const view = explainModule("src/domain/levels/level-1-lexical.ts", SOURCE, notes, KNOWN);

    expect(view.summary).toBe("A test module.");
    expect(view.notes.map((note) => [note.index, note.line, note.title])).toEqual([
      [1, 8, "First"],
      [2, 9, "Second"],
    ]);
    expect(view.lines[8]?.noteIndex).toBe(2);
    expect(() =>
      explainModule(
        "src/domain/levels/level-1-lexical.ts",
        SOURCE,
        { summary: "", notes: [{ at: "return", title: "Vague", text: "" }] },
        KNOWN,
      ),
    ).toThrow(/exactly one line/);
  });
});

describe("module registry", () => {
  it("Given the registry, When paths are listed, Then every implemented level is present as the specifier the pipeline imports and no spec file is", () => {
    const paths = listModulePaths();

    expect(paths.has("src/domain/levels/level-1-lexical.ts")).toBe(true);
    expect(paths.has("src/domain/index/inverted-index.ts")).toBe(true);
    expect([...paths].some((path) => path.endsWith(".spec.ts"))).toBe(false);
    expect(readModuleSource("src/domain/index/bm25.ts")).toContain("export function bm25Score");
  });

  it("Given relative specifiers, When resolved, Then parent segments collapse", () => {
    expect(resolvePath("src/domain/levels", "../index/bm25.ts")).toBe("src/domain/index/bm25.ts");
    expect(resolvePath("src/domain/levels", "./level-0-evaluation.ts")).toBe(
      "src/domain/levels/level-0-evaluation.ts",
    );
  });
});
