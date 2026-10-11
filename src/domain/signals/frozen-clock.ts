import type { Clock } from "../ports/clock.ts";

/**
 * A clock frozen at one instant. Ranking features such as recency read the clock many times,
 * once per candidate. If the clock advances between those reads, two listings posted at the
 * same moment get micro-different scores and their order depends on when the scorer happened
 * to look. Freezing the clock at the start of a scoring pass makes one query's ranking a pure
 * function of the data.
 */
export function freezeClock(clock: Clock): Clock {
  const at = clock.now();
  return { now: () => at };
}
