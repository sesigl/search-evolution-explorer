import { describe, expect, it } from "vitest";
import { staticHostingRoutes } from "./hosting-policy.ts";

describe("Vercel hosting boundary", () => {
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
