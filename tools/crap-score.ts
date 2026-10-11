export const CRAP_THRESHOLD = 30;

export function computeCrap(complexity: number, coverage: number): number {
  const uncovered = 1 - coverage;
  return complexity * complexity * uncovered * uncovered * uncovered + complexity;
}

export function isAboveCrapThreshold(score: number): boolean {
  return score > CRAP_THRESHOLD;
}
