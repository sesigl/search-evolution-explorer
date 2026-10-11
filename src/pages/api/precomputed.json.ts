import type { APIRoute } from "astro";
import { handlePrecomputeResults } from "../../actions/precompute-results.ts";
import { respondJson } from "./_json.ts";

/** Feeds npm run data:precompute. Production never computes the slow results on request. */
export const GET: APIRoute = () => {
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }
  return respondJson(() => handlePrecomputeResults());
};
