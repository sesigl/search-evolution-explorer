export interface CompositionPoint {
  readonly composesLevelId: string | null;
  readonly compositionPointLine: number | null;
}

const PREVIOUS_LEVEL_IMPORT = /from\s+["']\.\/(level-\d+-[a-z0-9-]+)\.ts["']/;
const WRAP_CALL = "createPrevious(";

export function findCompositionPoint(source: string): CompositionPoint {
  const importMatch = PREVIOUS_LEVEL_IMPORT.exec(source);
  if (importMatch === null) {
    return { composesLevelId: null, compositionPointLine: null };
  }
  const composesLevelId = importMatch[1];
  if (composesLevelId === undefined) {
    return { composesLevelId: null, compositionPointLine: null };
  }
  const lines = source.split("\n");
  const wrapIndex = lines.findIndex((line) => line.includes(WRAP_CALL));
  if (wrapIndex < 0) {
    return { composesLevelId, compositionPointLine: null };
  }
  return { composesLevelId, compositionPointLine: wrapIndex + 1 };
}
