import { checkBotId } from "botid/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { protectedApi } from "./protected-api.ts";

vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
  vi.mocked(checkBotId).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("hosted API identity boundary", () => {
  it("verifies identity again before returning a cached human result", async () => {
    const request = new Request("https://example.com/api/search.json?q=cached-human", {
      method: "POST",
    });
    const work = vi.fn(async () => Response.json({ result: "sofa" }));
    vi.mocked(checkBotId).mockResolvedValue({
      isHuman: true,
      isBot: false,
      isVerifiedBot: false,
      bypassed: false,
    });
    expect((await protectedApi(request, work)).status).toBe(200);
    vi.mocked(checkBotId).mockResolvedValue({
      isHuman: false,
      isBot: true,
      isVerifiedBot: true,
      bypassed: false,
    });
    expect((await protectedApi(request, work)).status).toBe(403);
    expect(work).toHaveBeenCalledTimes(1);
    expect(checkBotId).toHaveBeenCalledTimes(2);
  });
});
