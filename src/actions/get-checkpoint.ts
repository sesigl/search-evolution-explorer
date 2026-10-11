import { createApp } from "../di.ts";
import type { Checkpoint } from "../domain/evaluation/checkpoint.ts";

export type { Checkpoint } from "../domain/evaluation/checkpoint.ts";

/** Null when the level is the introduction, is not built, or cannot run on this machine. */
export async function handleGetCheckpoint(input: {
  levelId: string;
  queryText: string;
}): Promise<Checkpoint | null> {
  const app = await createApp();
  return app.getCheckpoint(input.levelId, input.queryText);
}
