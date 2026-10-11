import type { APIRoute } from "astro";
import { handleSearchWorkbench, parseWorkbenchRequest } from "../../actions/search-workbench.ts";

export const GET: APIRoute = async ({ url }) => {
  const { state } = await handleSearchWorkbench(parseWorkbenchRequest(url.searchParams));
  return new Response(JSON.stringify(state), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
