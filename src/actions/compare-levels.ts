import { createApp } from "../di.ts";
import type { CompareInput, CompareOutput } from "../domain/comparison/compare-levels.ts";

export async function handleCompareLevels(input: CompareInput): Promise<CompareOutput> {
  const app = await createApp();
  return app.compare(input);
}
