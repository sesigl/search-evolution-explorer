import { createApp } from "../di.ts";
import type { LevelSourceView } from "../domain/levels/level-source.ts";

export async function handleGetLevelSource(input: { levelId: string }): Promise<LevelSourceView> {
  const app = await createApp();
  return app.getLevelSource(input.levelId);
}
