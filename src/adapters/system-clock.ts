import type { Clock } from "../domain/ports/clock.ts";

export function createSystemClock(): Clock {
  return {
    now(): Date {
      return new Date();
    },
  };
}
