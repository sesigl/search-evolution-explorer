import { initBotId } from "botid/client/core";

let initialized = false;

/** Initialize before the first protected fetch, including searches from shared deep links. */
export function liveApi(url: string, signal?: AbortSignal): Promise<Response> {
  if (!initialized && document.documentElement.dataset["hosted"] === "vercel") {
    initBotId({
      protect: [
        { path: "/api/search.json", method: "POST" },
        { path: "/api/grade.json", method: "POST" },
        { path: "/api/compare.json", method: "POST" },
      ],
    });
    initialized = true;
  }
  return fetch(url, { method: "POST", ...(signal === undefined ? {} : { signal }) });
}

/** Both workbenches show verification and capacity errors instead of treating them as results. */
export async function liveJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await liveApi(url, signal);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body !== null && typeof body === "object" && "error" in body
        ? String(body.error)
        : "The request failed. Reload and try again.";
    throw new Error(message);
  }
  return body as T;
}
