import { initBotId } from "botid/client/core";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("botid/client/core", () => ({ initBotId: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("browser live API", () => {
  it("keeps a local production build usable without Vercel's challenge service", async () => {
    vi.stubGlobal("document", { documentElement: { dataset: { hosted: "local" } } });
    const fetch = vi.fn(async () => Response.json({ local: true }));
    vi.stubGlobal("fetch", fetch);
    const { liveApi } = await import("./live-api.ts");
    expect((await liveApi("/api/search.json?q=sofa")).status).toBe(200);
    expect(initBotId).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/api/search.json?q=sofa", { method: "POST" });
  });

  it("initializes protection before the first hosted request and only once", async () => {
    vi.stubGlobal("document", { documentElement: { dataset: { hosted: "vercel" } } });
    const fetch = vi.fn(async () => {
      expect(initBotId).toHaveBeenCalledTimes(1);
      return Response.json({ hosted: true });
    });
    vi.stubGlobal("fetch", fetch);
    const { liveApi } = await import("./live-api.ts");
    await liveApi("/api/search.json?q=sofa");
    await liveApi("/api/grade.json?q=marble");
    expect(initBotId).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
