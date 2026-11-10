import type { Scorecard } from "../../domain/types/evaluation.ts";

let pending: Promise<Scorecard> | undefined;

/** All teaching panels reuse one static report, not a new full evaluation per panel. */
export function fetchScorecard(): Promise<Scorecard> {
  pending ??= fetch("/api/scorecard.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("The scorecard is unavailable.");
      return (await response.json()) as Scorecard;
    })
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
