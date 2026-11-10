import { localJsonRoute } from "../../http/live-routes.ts";

export const prerender = false;
export const GET = localJsonRoute(async (params) => {
  const { handleGetCodeModule } = await import("../../actions/get-code-module.ts");
  return handleGetCodeModule({ path: params.get("path") ?? "" });
});
