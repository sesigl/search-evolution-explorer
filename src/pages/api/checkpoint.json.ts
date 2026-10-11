import type { APIRoute } from "astro";
import { handleGetCheckpoint } from "../../actions/get-checkpoint.ts";
import { respondJson } from "./_json.ts";

export const GET: APIRoute = ({ url }) =>
  respondJson(() =>
    handleGetCheckpoint({
      levelId: url.searchParams.get("level") ?? "level-1-recency",
      queryText: (url.searchParams.get("q") ?? "").trim(),
    }),
  );
