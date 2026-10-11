import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LevelListItem } from "../domain/levels/list-levels.ts";
import { UseCaseError } from "../domain/search/errors.ts";
import type { SearchOutput } from "../domain/search/run-search.ts";
import type { CorpusItem } from "../domain/types/corpus.ts";
import { handleGetLevels } from "./get-levels.ts";
import { handleSearch } from "./search.ts";
import { handleSearchWorkbench, parseWorkbenchRequest } from "./search-workbench.ts";

vi.mock("./get-levels.ts", () => ({ handleGetLevels: vi.fn() }));
vi.mock("./search.ts", () => ({ handleSearch: vi.fn() }));

function levelItem(overrides: Partial<LevelListItem>): LevelListItem {
  return {
    id: "level-1-lexical",
    ordinal: 1,
    label: "Lexical match",
    capability: "",
    mechanism: "",
    tradeOff: "",
    fixesFailureMode: null,
    changes: "scoring",
    implemented: true,
    prerequisiteState: "ready",
    unavailableReason: null,
    rebuildCommand: null,
    ...overrides,
  };
}

function corpusItem(id: string): CorpusItem {
  return {
    id,
    title: `Listing ${id}`,
    description: "",
    categoryId: "furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: "2026-09-01T00:00:00.000Z",
    available: true,
  };
}

function searchOutput(): SearchOutput {
  return {
    results: [
      {
        item: corpusItem("a"),
        position: 1,
        score: 0.5,
        signals: [{ name: "bm25", value: 0.5, explanation: "bm25" }],
      },
    ],
    understanding: {
      rawText: "lamp",
      tokens: ["lamp"],
      normalizedTokens: ["lamp"],
      expandedTokens: ["lamp"],
      predictedCategoryId: null,
      priceConstraint: null,
      spellingCorrection: [],
      queryVector: null,
    },
    candidateWidth: 12,
    elapsedMs: 3,
    appliedCorrections: [],
    concepts: [],
    level: {
      id: "level-1-lexical",
      ordinal: 1,
      label: "Lexical match",
      capability: "",
      changes: "scoring",
      mechanism: "",
      tradeOff: "",
      fixesFailureMode: null,
    },
  };
}

beforeEach(() => {
  vi.mocked(handleGetLevels).mockReset();
  vi.mocked(handleSearch).mockReset();
});

describe("parse workbench request", () => {
  it("defaults to the recency level, all levers on and page 1", () => {
    expect(parseWorkbenchRequest(new URLSearchParams())).toEqual({
      query: "",
      levelId: "level-1-recency",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
  });

  it("reads the query, level and page and trims the query", () => {
    const request = parseWorkbenchRequest(
      new URLSearchParams({ q: "  lamp  ", level: "level-3-learned", page: "2" }),
    );
    expect(request).toMatchObject({ query: "lamp", levelId: "level-3-learned", page: 2 });
  });

  it("turns a named lever on and every unnamed lever off", () => {
    const request = parseWorkbenchRequest(new URLSearchParams({ stemming: "1" }));
    expect(request.levers).toEqual({ stemming: true, synonyms: false, variants: false });
  });

  it("reads the levers-none marker as every lever off", () => {
    expect(parseWorkbenchRequest(new URLSearchParams({ levers: "none" })).levers).toEqual({
      stemming: false,
      synonyms: false,
      variants: false,
    });
  });

  it("falls back to page 1 for a missing, zero, negative or fractional page", () => {
    expect(parseWorkbenchRequest(new URLSearchParams()).page).toBe(1);
    expect(parseWorkbenchRequest(new URLSearchParams({ page: "" })).page).toBe(1);
    expect(parseWorkbenchRequest(new URLSearchParams({ page: "0" })).page).toBe(1);
    expect(parseWorkbenchRequest(new URLSearchParams({ page: "-2" })).page).toBe(1);
    expect(parseWorkbenchRequest(new URLSearchParams({ page: "1.5" })).page).toBe(1);
  });
});

describe("search workbench", () => {
  const levels = [
    levelItem({ id: "level-0-evaluation", ordinal: 0, label: "Evaluation", changes: "both" }),
    levelItem({}),
    levelItem({
      id: "level-3-learned",
      ordinal: 3,
      label: "Learned",
      rebuildCommand: "npm run data:train",
    }),
    levelItem({ id: "level-6-two-tower", ordinal: 6, label: "Two-tower", implemented: false }),
  ];

  beforeEach(() => {
    vi.mocked(handleGetLevels).mockResolvedValue({ levels });
  });

  it("treats an unknown level as the evaluation introduction and runs no search", async () => {
    const { state } = await handleSearchWorkbench({
      query: "lamp",
      levelId: "level-99",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
    expect(state.mode).toBe("evaluation");
    expect(state.selected).toBeNull();
    expect(state.view).toBeNull();
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it("returns a preview level without searching", async () => {
    const { state } = await handleSearchWorkbench({
      query: "lamp",
      levelId: "level-6-two-tower",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
    expect(state.mode).toBe("preview");
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it("rejects an over-length query before searching", async () => {
    const { state } = await handleSearchWorkbench({
      query: "a".repeat(201),
      levelId: "level-1-lexical",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
    expect(state.error).toMatchObject({ kind: "over-length", command: null });
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it("returns an empty state for an empty query", async () => {
    const { state } = await handleSearchWorkbench({
      query: "",
      levelId: "level-1-lexical",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
    expect(state.error).toBeNull();
    expect(state.view).toBeNull();
  });

  it("maps a successful search into the view and clamps the page", async () => {
    vi.mocked(handleSearch).mockResolvedValue(searchOutput());
    const { state } = await handleSearchWorkbench({
      query: "lamp",
      levelId: "level-1-lexical",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 99,
    });
    expect(handleSearch).toHaveBeenCalledWith({
      queryText: "lamp",
      levelId: "level-1-lexical",
      leverOverrides: { stemming: true, synonyms: true, variants: true },
      limit: 10,
      offset: 980,
    });
    expect(handleSearch).toHaveBeenCalledWith({
      queryText: "lamp",
      levelId: "level-1-lexical",
      leverOverrides: { stemming: true, synonyms: true, variants: true },
      limit: 10,
      offset: 10,
    });
    expect(state.view?.page).toBe(2);
    expect(state.view?.pageCount).toBe(2);
    expect(state.view?.results[0]).toMatchObject({ id: "a", position: 1, score: 0.5 });
    expect(state.view?.understanding.tokens).toEqual(["lamp"]);
  });

  it("turns a use-case failure into an unavailable state with the rebuild command", async () => {
    vi.mocked(handleSearch).mockRejectedValue(new UseCaseError("PRECONDITION_FAILED", "missing"));
    const { state } = await handleSearchWorkbench({
      query: "lamp",
      levelId: "level-3-learned",
      levers: { stemming: true, synonyms: true, variants: true },
      page: 1,
    });
    expect(state.error).toEqual({
      kind: "unavailable",
      message: "missing",
      command: "npm run data:train",
    });
  });

  it("rethrows an unexpected failure", async () => {
    vi.mocked(handleSearch).mockRejectedValue(new Error("boom"));
    await expect(
      handleSearchWorkbench({
        query: "lamp",
        levelId: "level-1-lexical",
        levers: { stemming: true, synonyms: true, variants: true },
        page: 1,
      }),
    ).rejects.toThrow("boom");
  });
});
