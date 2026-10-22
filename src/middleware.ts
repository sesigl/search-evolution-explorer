import { defineMiddleware } from "astro:middleware";

/**
 * Every page and JSON answer is a function of the request URL and the deployed code and data:
 * search runs offline and the slow results are precomputed. So a successful GET can be served
 * from Vercel's CDN until the next deployment, which purges that cache. Browsers revalidate,
 * so a reader never keeps an answer from an older deployment. Errors are not cached.
 */
const CDN_CACHE = "public, max-age=31536000, stale-while-revalidate=86400";
const BROWSER_CACHE = "public, max-age=0, must-revalidate";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.request.method === "GET" && response.status === 200 && !context.isPrerendered) {
    if (!response.headers.has("cache-control")) {
      response.headers.set("cache-control", BROWSER_CACHE);
    }
    response.headers.set("vercel-cdn-cache-control", CDN_CACHE);
  }
  return response;
});
