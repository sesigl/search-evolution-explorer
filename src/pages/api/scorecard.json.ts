import type { APIRoute } from "astro";
import { handleGetScorecard } from "../../actions/get-scorecard.ts";
import { respondJson } from "./_json.ts";

export const GET: APIRoute = () => respondJson(() => handleGetScorecard(undefined));
