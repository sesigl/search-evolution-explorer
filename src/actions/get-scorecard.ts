import { createApp } from "../di.ts";
import type { Scorecard } from "../domain/types/evaluation.ts";

export async function handleGetScorecard(
  levelIds: readonly string[] | undefined,
): Promise<Scorecard> {
  const app = await createApp();
  return await app.getScorecard(levelIds);
}
