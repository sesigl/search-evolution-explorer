export const POSITION_DECAY_DESCRIPTION =
  "Examination probability is 1/rank for 1-based rank. A listing at position 1 is examined with probability 1, at position 2 with probability 0.5, and so on.";

export function positionDecay(rank: number): number {
  if (rank < 1) {
    return 0;
  }
  return 1 / rank;
}
