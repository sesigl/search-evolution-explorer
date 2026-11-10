import { describe, expect, it, vi } from "vitest";
import { serveLiveRequest } from "./live-request.ts";

describe("live search protection", () => {
  it("rejects a crawler GET before checking identity or starting search", async () => {
    const verify = vi.fn();
    const work = vi.fn();
    const response = await serveLiveRequest(new Request("https://example.com/api/search.json"), {
      hosted: true,
      verify,
      work,
    });
    expect(response.status).toBe(405);
    expect(verify).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });

  it("rejects bots before starting expensive work, including verified crawlers", async () => {
    const work = vi.fn();
    const response = await serveLiveRequest(
      new Request("https://example.com/api/search.json?q=sofa", {
        method: "POST",
        headers: { origin: "https://example.com" },
      }),
      { hosted: true, verify: async () => ({ isHuman: false, isBot: true }), work },
    );
    expect(response.status).toBe(403);
    expect(work).not.toHaveBeenCalled();
  });

  it("runs a verified human request and never puts the response in a shared cache", async () => {
    const work = vi.fn(async (params: URLSearchParams) => Response.json({ q: params.get("q") }));
    const response = await serveLiveRequest(
      new Request("https://example.com/api/search.json?q=blue+sofa", { method: "POST" }),
      { hosted: true, verify: async () => ({ isHuman: true, isBot: false }), work },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ q: "blue sofa" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps local GET tools usable without bot verification", async () => {
    const verify = vi.fn();
    const response = await serveLiveRequest(new Request("http://localhost:4321/api/search.json"), {
      hosted: false,
      verify,
      work: async () => Response.json({ local: true }),
    });
    expect(response.status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed when the verification service is unavailable", async () => {
    const work = vi.fn();
    const response = await serveLiveRequest(
      new Request("https://example.com/api/search.json", { method: "POST" }),
      {
        hosted: true,
        verify: () => Promise.reject(new Error("Verification unavailable")),
        work,
      },
    );
    expect(response.status).toBe(503);
    expect(work).not.toHaveBeenCalled();
  });

  it("rejects oversized query input before verification or search initialization", async () => {
    const verify = vi.fn();
    const work = vi.fn();
    const response = await serveLiveRequest(
      new Request(`https://example.com/api/search.json?q=${"a".repeat(201)}`, { method: "POST" }),
      { hosted: true, verify, work },
    );
    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });
});
