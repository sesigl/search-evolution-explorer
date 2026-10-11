import { createApp } from "../di.ts";
import type { LevelListItem } from "../domain/levels/list-levels.ts";

export async function handleGetLevels(): Promise<{ levels: LevelListItem[] }> {
  const app = await createApp();
  return { levels: app.getLevels() };
}
