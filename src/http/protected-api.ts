import process from "node:process";
import { serveLiveRequest } from "./live-request.ts";
import { createResponseCache } from "./response-cache.ts";

const cachedResponse = createResponseCache(64, 60_000);

/** BotID Basic is free. Never trust a User-Agent string or a client-supplied human flag. */
export function protectedApi(
  request: Request,
  work: (params: URLSearchParams) => Promise<Response>,
): Promise<Response> {
  return serveLiveRequest(request, {
    hosted: process.env["VERCEL"] === "1",
    async verify() {
      const { checkBotId } = await import("botid/server");
      return checkBotId({
        developmentOptions: { isDevelopment: false },
        advancedOptions: {
          checkLevel: "basic",
          headers: Object.fromEntries(request.headers),
        },
      });
    },
    work(params) {
      const sorted = new URLSearchParams(params);
      sorted.sort();
      const key = `${new URL(request.url).pathname}?${sorted.toString()}`;
      // Identity is checked for EVERY request, even when a result is already cached.
      return cachedResponse(key, () => work(params));
    },
  });
}
