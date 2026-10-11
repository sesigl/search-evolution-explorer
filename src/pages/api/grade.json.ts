import type { APIRoute } from "astro";
import { handleGradeQuery } from "../../actions/grade-query.ts";
import { respondJson } from "./_json.ts";

export const GET: APIRoute = ({ url }) =>
  respondJson(() =>
    handleGradeQuery({
      queryText: (url.searchParams.get("q") ?? "").trim(),
      levelId: url.searchParams.get("level") ?? "level-1-recency",
    }),
  );
