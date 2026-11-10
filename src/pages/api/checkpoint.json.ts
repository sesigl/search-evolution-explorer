import { localJsonRoute } from "../../http/live-routes.ts";

export const prerender = false;
export const GET = localJsonRoute(async (params) => {
  const { handleGetCheckpoint } = await import("../../actions/get-checkpoint.ts");
  return handleGetCheckpoint({
    levelId: params.get("level") ?? "level-1-recency",
    queryText: (params.get("q") ?? "").trim(),
  });
});
