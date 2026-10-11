import { createApp } from "../di.ts";

export async function handleGetItemTitle(input: { itemId: string }): Promise<string> {
  const app = await createApp();
  return app.getItemTitle(input.itemId);
}
