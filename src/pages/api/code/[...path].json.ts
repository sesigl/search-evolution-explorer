import type { APIRoute } from "astro";
import { handleGetCodeModule } from "../../../actions/get-code-module.ts";
import { listModulePaths } from "../../../domain/code/module-registry.ts";
import { respondJson } from "../../../http/json.ts";

/** Code browsing is a finite set of files, not an on-demand server operation. */
export function getStaticPaths() {
  return [...listModulePaths()].map((path) => ({ params: { path } }));
}

export const GET: APIRoute = ({ params }) =>
  respondJson(() => handleGetCodeModule({ path: params["path"] ?? "" }));
