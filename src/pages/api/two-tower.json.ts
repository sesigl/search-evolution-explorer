import type { APIRoute } from "astro";
import { handleTowerTrainingReport } from "../../actions/get-tower-training-report.ts";
import { respondJson } from "../../http/json.ts";

export const GET: APIRoute = () => respondJson(handleTowerTrainingReport);
