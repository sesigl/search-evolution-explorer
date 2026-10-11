import { createApp } from "../di.ts";

export async function handlePrecomputeResults() {
  const app = await createApp();
  return await app.precomputeResults();
}
