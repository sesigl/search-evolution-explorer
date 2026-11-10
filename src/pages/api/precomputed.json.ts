import { localJsonRoute } from "../../http/live-routes.ts";

export const prerender = false;
export const GET = localJsonRoute(async () => {
  const { handlePrecomputeResults } = await import("../../actions/precompute-results.ts");
  return handlePrecomputeResults();
});
