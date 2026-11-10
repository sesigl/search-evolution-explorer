import { afterEach, describe, expect, it, vi } from "vitest";
import { staticHostingRoutes } from "./hosting-policy.ts";

interface ChallengeScript {
  src: string;
  onload?: () => void;
  onerror?: (event: Event) => void;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("installed BotID client and CDN routing", () => {
  it("loads its challenge through the hosting policy before sending protected POST requests", async () => {
    // Run the real SDK against browser API doubles. Only the remote challenge is a fixture;
    // this checks the transport contract, not Vercel's human/bot classification.
    const requests = vi.fn(async () => Response.json({ ok: true }));
    const events = new EventTarget();
    const scripts: string[] = [];
    const routes = staticHostingRoutes([{ handle: "filesystem" }]);
    vi.stubGlobal("fetch", requests);
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("location", new URL("https://example.com"));
    vi.stubGlobal("V_C", undefined);
    vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
    vi.stubGlobal("XMLHttpRequest", { prototype: { open() {}, send() {} } });
    vi.stubGlobal("document", {
      documentElement: { dataset: { hosted: "vercel" } },
      querySelector: () => null,
      createElement: () => ({ src: "" }),
      head: {
        appendChild(script: ChallengeScript) {
          scripts.push(script.src);
          const path = new URL(script.src, "https://example.com").pathname;
          const route = routes.find(
            (entry) => entry.src !== undefined && new RegExp(entry.src).test(path),
          );
          queueMicrotask(() => {
            if (route?.dest !== "https://api.vercel.com/bot-protection/v1/challenge") {
              script.onerror?.(new Event("error"));
              return;
            }
            window.V_C?.push({ b: 1, v: "1", e: "test-challenge", d: 0 });
            script.onload?.();
          });
        },
      },
    });
    const { liveApi } = await import("../src/islands/shared/live-api.ts");
    for (const api of ["search", "grade", "compare"]) {
      const response = await liveApi(`/api/${api}.json?q=sofa`);
      expect(response.status).toBe(200);
    }
    expect(scripts).toHaveLength(3);
    expect(requests).toHaveBeenCalledTimes(3);
    for (const [url, options] of requests.mock.calls as unknown as [string, RequestInit][]) {
      const headers = new Headers(options.headers);
      expect(headers.get("x-is-human")).toBe(
        JSON.stringify({ b: 1, v: "1", e: "test-challenge", d: 0 }),
      );
      expect(headers.get("x-path")).toBe(new URL(url, "https://example.com").pathname);
      expect(headers.get("x-method")).toBe("POST");
    }
  });
});
