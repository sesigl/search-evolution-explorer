import { describe, expect, it, vi } from "vitest";
import { createResponseCache } from "./response-cache.ts";

describe("bounded live response cache", () => {
  it("shares in-flight work and gives each caller its own response body", async () => {
    const cached = createResponseCache(2, 1000, () => 0);
    const work = vi.fn(async () => Response.json({ results: ["sofa"] }));
    const [first, second] = await Promise.all([
      cached("same-query", work),
      cached("same-query", work),
    ]);
    expect(work).toHaveBeenCalledTimes(1);
    expect(await first.json()).toEqual({ results: ["sofa"] });
    expect(await second.json()).toEqual({ results: ["sofa"] });
  });

  it("expires results and evicts old keys so unique queries cannot grow memory without a bound", async () => {
    let time = 0;
    const cached = createResponseCache(1, 1000, () => time);
    const work = vi.fn(async () => Response.json({ ok: true }));
    await cached("a", work);
    await cached("a", work);
    time = 1000;
    await cached("a", work);
    await cached("b", work);
    await cached("a", work);
    expect(work).toHaveBeenCalledTimes(4);
  });

  it("does not cache failed work or HTTP errors", async () => {
    const cached = createResponseCache(2, 1000, () => 0);
    const failed = vi.fn(() => Promise.reject(new Error("temporary failure")));
    await expect(cached("a", failed)).rejects.toThrow("temporary failure");
    const work = vi.fn(async () => Response.json({ error: "try later" }, { status: 503 }));
    await cached("a", work);
    await cached("a", work);
    expect(work).toHaveBeenCalledTimes(2);
  });
});
