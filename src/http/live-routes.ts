import type { APIRoute } from "astro";
import { respondJson } from "./json.ts";
import { protectedApi } from "./protected-api.ts";

function liveRoute(work: (params: URLSearchParams) => Promise<unknown>): APIRoute {
  return ({ request }) => protectedApi(request, (params) => respondJson(() => work(params)));
}

// The dynamic imports matter: rejected bots must not load the catalog or neural runtime.
export const searchRoute = liveRoute(async (params) => {
  const { handleSearchWorkbench, parseWorkbenchRequest } = await import(
    "../actions/search-workbench.ts"
  );
  return (await handleSearchWorkbench(parseWorkbenchRequest(params))).state;
});

export const gradeRoute = liveRoute(async (params) => {
  const { handleGradeQuery } = await import("../actions/grade-query.ts");
  return handleGradeQuery({
    queryText: (params.get("q") ?? "").trim(),
    levelId: params.get("level") ?? "level-1-recency",
  });
});

export const compareRoute = liveRoute(async (params) => {
  const { handleCompareLevels } = await import("../actions/compare-levels.ts");
  return handleCompareLevels({
    queryText: params.get("q") ?? "",
    leftLevelId: params.get("left") ?? "level-1-recency",
    rightLevelId: params.get("right") ?? "level-1-normalization",
  });
});

/** Evaluation scripts run locally. These endpoints never execute work in a production build. */
export function localJsonRoute(work: (params: URLSearchParams) => Promise<unknown>): APIRoute {
  return ({ url }) =>
    import.meta.env.DEV
      ? respondJson(() => work(url.searchParams))
      : new Response(null, { status: 404 });
}
