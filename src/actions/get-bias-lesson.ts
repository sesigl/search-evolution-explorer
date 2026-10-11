import { createApp } from "../di.ts";
import type { BiasLesson } from "../domain/ranking/bias-lesson.ts";

export async function handleGetBiasLesson(): Promise<BiasLesson> {
  const app = await createApp();
  return app.getBiasLesson();
}
