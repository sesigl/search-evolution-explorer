import { createApp } from "../di.ts";
import type { CodeModuleView } from "../domain/code/explain-module.ts";

export type {
  CodeDefinition,
  CodeLine,
  CodeLink,
  CodeModuleView,
} from "../domain/code/explain-module.ts";

export async function handleGetCodeModule(input: { path: string }): Promise<CodeModuleView> {
  const app = await createApp();
  return app.getCodeModule(input.path);
}
