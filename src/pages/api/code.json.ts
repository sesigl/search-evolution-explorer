import type { APIRoute } from "astro";
import { handleGetCodeModule } from "../../actions/get-code-module.ts";
import { respondJson } from "./_json.ts";

export const GET: APIRoute = ({ url }) =>
  respondJson(() => handleGetCodeModule({ path: url.searchParams.get("path") ?? "" }));
