import { describe, expect, it } from "vitest";
import { staticHostingRoutes } from "./hosting-policy.ts";

describe("Vercel hosting boundary", () => {
  it("proxies the installed BotID client's challenge before the static fallback", () => {
    const path =
      "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js";
    const routes = staticHostingRoutes([{ handle: "filesystem" }]);
    const route = routes.find(
      (entry) => entry.src !== undefined && new RegExp(entry.src).test(path),
    );
    expect(route).toEqual({
      src: expect.any(String),
      dest: "https://api.vercel.com/bot-protection/v1/challenge",
      headers: { "X-Frame-Options": "SAMEORIGIN" },
    });
  });

  it.each(["p.js", "a-4-a/tl"])("proxies BotID %s traffic without invoking search", (suffix) => {
    const path = `/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/${suffix}`;
    const routes = staticHostingRoutes([{ handle: "filesystem" }]);
    const route = routes.find(
      (entry) => entry.src !== undefined && new RegExp(entry.src).test(path),
    );
    const match = new RegExp(route?.src ?? "").exec(path);
    expect(route?.dest?.replace("$1", match?.[1] ?? "")).toBe(
      `https://api.vercel.com/bot-protection/v1/proxy/${suffix}`,
    );
    expect(route?.headers).toEqual({ "X-Frame-Options": "SAMEORIGIN" });
  });

  it("routes only live POST APIs to a function; GETs and unknown paths stay at the CDN", () => {
    const routes = staticHostingRoutes([
      { handle: "filesystem" },
      { src: "^/api/search\\.json$", dest: "_render" },
      { src: "^/.*$", dest: "_render" },
    ]);
    const functions = routes.filter((route) => route.dest === "_render");
    expect(functions).toHaveLength(3);
    expect(functions.every((route) => route.methods?.join() === "POST")).toBe(true);
    expect(routes.at(-1)).toEqual({ src: "^/.*$", dest: "/404.html", status: 404 });
  });

  it("fails the build if a page is accidentally made server-rendered", () => {
    expect(() => staticHostingRoutes([{ src: "^/search/?$", dest: "_render" }])).toThrow(
      "Unexpected server route",
    );
  });

  it("is safe to run twice on the same build output", () => {
    const once = staticHostingRoutes([{ handle: "filesystem" }, { src: "^/.*$", dest: "_render" }]);
    expect(staticHostingRoutes(once)).toEqual(once);
  });

  it("removes local tools and framework catch-alls while keeping static caching rules", () => {
    const cacheRule = {
      src: "^/_astro/(.*)$",
      headers: { "cache-control": "immutable" },
      continue: true,
    };
    const routes = staticHostingRoutes([
      cacheRule,
      { handle: "filesystem" },
      { src: "^/api/precomputed\\.json$", dest: "_render" },
      { src: "^/_image/?$", dest: "_render" },
      { src: "^/.*$", dest: "_render" },
    ]);
    expect(routes).toContainEqual(cacheRule);
    const resolve = (path: string, method: string) =>
      routes.find(
        (route) =>
          route.src !== undefined &&
          new RegExp(route.src).test(path) &&
          (route.methods === undefined || route.methods.includes(method)),
      );
    expect(resolve("/api/search.json", "POST")?.dest).toBe("_render");
    expect(resolve("/api/search.json", "GET")?.status).toBe(405);
    expect(resolve("/api/precomputed.json", "GET")?.status).toBe(404);
    expect(resolve("/wp-admin", "GET")?.status).toBe(404);
    expect(resolve("/_render", "POST")?.status).toBe(404);
  });
});
