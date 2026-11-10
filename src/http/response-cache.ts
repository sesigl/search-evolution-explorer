interface StoredResponse {
  readonly body: string;
  readonly status: number;
  readonly headers: [string, string][];
}

/** Per-instance optimization only, never a distributed rate limit or an identity check. */
export function createResponseCache(capacity: number, ttlMs: number, now = Date.now) {
  const entries = new Map<string, { until: number; pending: Promise<StoredResponse> }>();
  return async (key: string, work: () => Promise<Response>): Promise<Response> => {
    let entry = entries.get(key);
    if (entry === undefined || entry.until <= now()) {
      const pending = work().then(async (response) => ({
        body: await response.text(),
        status: response.status,
        headers: [...response.headers],
      }));
      entry = { until: now() + ttlMs, pending };
      entries.delete(key);
      entries.set(key, entry);
      if (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    }
    const current = entry;
    const forget = () => {
      if (entries.get(key) === current) entries.delete(key);
    };
    const stored = await current.pending.catch((error: unknown) => {
      forget();
      throw error;
    });
    // Bound retained payload size as well as the entry count.
    if (stored.status >= 400 || new TextEncoder().encode(stored.body).byteLength > 100_000)
      forget();
    return new Response(stored.body, { status: stored.status, headers: stored.headers });
  };
}
