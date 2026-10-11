export function compareScoreThenId(
  left: readonly [string, number],
  right: readonly [string, number],
): number {
  if (right[1] !== left[1]) {
    return right[1] - left[1];
  }
  return left[0].localeCompare(right[0]);
}
