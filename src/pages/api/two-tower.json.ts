import type { APIRoute } from "astro";
import { handleTowerTrainingReport } from "../../actions/get-tower-training-report.ts";
import { respondJson } from "./_json.ts";

export const GET: APIRoute = () => respondJson(handleTowerTrainingReport);
