import type { LevelListItem } from "../domain/levels/list-levels.ts";
import { extractQueryConcepts, retokenize } from "../domain/query-understanding/entities.ts";
import { UseCaseError } from "../domain/search/errors.ts";
import type { SearchOutput } from "../domain/search/run-search.ts";
import { handleGetGuidedExample } from "./get-guided-example.ts";
import { handleGetLevels } from "./get-levels.ts";
import { handleSearch } from "./search.ts";

/** Plain data for the search workbench island; every field survives JSON. */
export interface WorkbenchLevers {
  readonly stemming: boolean;
  readonly synonyms: boolean;
  readonly variants: boolean;
}

export interface WorkbenchSignal {
  readonly name: string;
  readonly value: number;
  readonly explanation: string;
  /** Multiplier applied to this signal in the score, when the level uses weights. */
  readonly weight?: number | undefined;
}

export interface WorkbenchResult {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string;
  readonly priceCents: number;
  readonly location: string;
  readonly postedAt: string;
  readonly position: number;
  readonly score: number;
  readonly signals: readonly WorkbenchSignal[];
}

export interface WorkbenchUnderstanding {
  readonly tokens: readonly string[];
  readonly normalizedTokens: readonly string[];
  readonly expandedTokens: readonly string[];
  readonly predictedCategoryId: string | null;
  readonly spellingCorrection: readonly { readonly from: string; readonly to: string }[];
  /** Fixes the running chapter applied before lookup; empty below chapter 4. */
  readonly appliedCorrections: readonly { readonly from: string; readonly to: string }[];
  /** Ontology concepts the running chapter enforced; empty below chapter 5. */
  readonly concepts: readonly {
    readonly type: string;
    readonly value: string;
    /** True when only previewed: named here, enforced from chapter 5. */
    readonly preview: boolean;
  }[];
}

interface WorkbenchLevel {
  readonly id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly capability: string;
  readonly changes: "matching" | "scoring" | "both";
  readonly mechanism: string;
  readonly tradeOff: string;
  readonly fixesFailureMode: string | null;
}

interface WorkbenchView {
  readonly results: readonly WorkbenchResult[];
  readonly understanding: WorkbenchUnderstanding;
  readonly candidateWidth: number;
  readonly elapsedMs: number;
  readonly level: WorkbenchLevel;
  readonly page: number;
  readonly pageCount: number;
}

interface WorkbenchExample {
  readonly queryText: string;
  readonly expectedDifference: string;
  readonly comparedWithLevelId: string;
  readonly comparedWithOrdinal: number | null;
}

interface WorkbenchError {
  readonly kind: "over-length" | "unavailable";
  readonly message: string;
  readonly command: string | null;
}

export interface WorkbenchState {
  readonly query: string;
  readonly levelId: string;
  readonly levers: WorkbenchLevers;
  readonly mode: "search" | "evaluation" | "preview";
  readonly selected: LevelListItem | null;
  readonly view: WorkbenchView | null;
  readonly error: WorkbenchError | null;
  readonly examples: readonly WorkbenchExample[];
}

export interface WorkbenchRequest {
  readonly query: string;
  readonly levelId: string;
  readonly levers: WorkbenchLevers;
  readonly page: number;
}

const MAX_QUERY_LENGTH = 200;
const PAGE_SIZE = 10;

export function parseWorkbenchRequest(params: URLSearchParams): WorkbenchRequest {
  // Levers default to on. They are read from the URL only when the URL names at least one
  // lever, or carries the `levers` marker the form and the island add when all are off.
  const explicit =
    params.has("levers") ||
    params.has("stemming") ||
    params.has("synonyms") ||
    params.has("variants");
  return {
    query: (params.get("q") ?? "").trim(),
    levelId: params.get("level") ?? "level-1-recency",
    levers: {
      stemming: explicit ? params.has("stemming") : true,
      synonyms: explicit ? params.has("synonyms") : true,
      variants: explicit ? params.has("variants") : true,
    },
    page: parsePage(params.get("page")),
  };
}

function parsePage(raw: string | null): number {
  if (raw === null || raw === "") {
    return 1;
  }
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }
  return page;
}

export async function handleSearchWorkbench(
  request: WorkbenchRequest,
): Promise<{ levels: LevelListItem[]; state: WorkbenchState }> {
  const { levels } = await handleGetLevels();
  const selected = levels.find((level) => level.id === request.levelId) ?? null;
  const mode: WorkbenchState["mode"] =
    selected === null || selected.ordinal === 0
      ? "evaluation"
      : selected.implemented
        ? "search"
        : "preview";
  const base = { ...request, mode, selected, examples: examplesFor(request.levelId) };
  // An unknown level id must say so, not silently fall back to the introduction.
  const unknownLevel =
    selected === null
      ? {
          kind: "unavailable" as const,
          message: `Unknown level “${request.levelId}”. Pick a chapter from the contents.`,
          command: null,
        }
      : null;

  if (request.query.length > MAX_QUERY_LENGTH) {
    return {
      levels,
      state: {
        ...base,
        view: null,
        error: {
          kind: "over-length",
          message: `The query is longer than ${MAX_QUERY_LENGTH} characters. Shorten it and search again.`,
          command: null,
        },
      },
    };
  }
  if (request.query === "" || mode !== "search") {
    return { levels, state: { ...base, view: null, error: unknownLevel } };
  }
  try {
    const search = (page: number) =>
      handleSearch({
        queryText: request.query,
        levelId: request.levelId,
        leverOverrides: request.levers,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
    const output = await search(request.page);
    const pageCount = Math.max(1, Math.ceil(output.candidateWidth / PAGE_SIZE));
    if (request.page <= pageCount) {
      return { levels, state: { ...base, view: toView(output, request.page), error: null } };
    }
    // A hand-edited page past the end shows the last page, not an empty list.
    const last = await search(pageCount);
    return { levels, state: { ...base, view: toView(last, pageCount), error: null } };
  } catch (error) {
    if (error instanceof UseCaseError) {
      return {
        levels,
        state: {
          ...base,
          view: null,
          error: {
            kind: "unavailable",
            message: error.message,
            command: selected?.rebuildCommand ?? null,
          },
        },
      };
    }
    throw error;
  }
}

function examplesFor(levelId: string): WorkbenchExample[] {
  try {
    return handleGetGuidedExample({ levelId }).examples.map((example) => ({
      queryText: example.queryText,
      expectedDifference: example.expectedDifference,
      comparedWithLevelId: example.comparedWithLevelId,
      comparedWithOrdinal: example.comparedWithOrdinal,
    }));
  } catch {
    return [];
  }
}

/**
 * Concepts for the panel: enforced ones from chapter 5, plus a greyed preview at chapter 4
 * (from the corrected words) so the before/after comparison reads both ways.
 */
function conceptsForView(output: SearchOutput): WorkbenchUnderstanding["concepts"] {
  if (output.concepts.length > 0) {
    return output.concepts.map((concept) => ({
      type: concept.type,
      value: concept.value,
      preview: false,
    }));
  }
  if (output.level.ordinal !== 4) {
    return [];
  }
  const tokens = retokenize(output.understanding.tokens, output.appliedCorrections);
  const tagged =
    tokens === output.understanding.tokens
      ? output.understanding
      : { ...output.understanding, tokens };
  return extractQueryConcepts(tagged).map((concept) => ({
    type: concept.type,
    value: concept.value,
    preview: true,
  }));
}

function toView(output: SearchOutput, requestedPage: number): WorkbenchView {
  const pageCount = Math.max(1, Math.ceil(output.candidateWidth / PAGE_SIZE));
  return {
    results: output.results.map((result) => ({
      id: result.item.id,
      title: result.item.title,
      description: result.item.description,
      categoryId: result.item.categoryId,
      priceCents: result.item.priceCents,
      location: result.item.location,
      postedAt: result.item.postedAt,
      position: result.position,
      score: result.score,
      signals: result.signals.map((signal) => ({
        name: signal.name,
        value: signal.value,
        explanation: signal.explanation,
        weight: signal.weight,
      })),
    })),
    understanding: {
      tokens: output.understanding.tokens,
      normalizedTokens: output.understanding.normalizedTokens,
      expandedTokens: output.understanding.expandedTokens,
      predictedCategoryId: output.understanding.predictedCategoryId,
      spellingCorrection: output.understanding.spellingCorrection,
      appliedCorrections: output.appliedCorrections,
      concepts: conceptsForView(output),
    },
    candidateWidth: output.candidateWidth,
    elapsedMs: output.elapsedMs,
    level: {
      id: output.level.id,
      ordinal: output.level.ordinal,
      label: output.level.label,
      capability: output.level.capability,
      changes: output.level.changes,
      mechanism: output.level.mechanism,
      tradeOff: output.level.tradeOff,
      fixesFailureMode: output.level.fixesFailureMode,
    },
    page: Math.min(requestedPage, pageCount),
    pageCount,
  };
}
