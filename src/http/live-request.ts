interface LiveRequestOptions {
  readonly hosted: boolean;
  readonly verify: () => Promise<{ isHuman: boolean; isBot: boolean }>;
  readonly work: (params: URLSearchParams) => Promise<Response>;
}

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

/** Cheap checks run before importing the search application or opening any data/model files. */
export async function serveLiveRequest(
  request: Request,
  options: LiveRequestOptions,
): Promise<Response> {
  if (options.hosted && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { ...PRIVATE_HEADERS, allow: "POST" } });
  }
  const params = new URL(request.url).searchParams;
  if (request.url.length > 4096 || (params.get("q") ?? "").length > 200) {
    return Response.json(
      { error: "The query is too long. Use at most 200 characters." },
      {
        status: 400,
        headers: PRIVATE_HEADERS,
      },
    );
  }
  if (options.hosted) {
    const verdict = await options.verify().catch(() => null);
    if (verdict === null) {
      return Response.json(
        { error: "Browser verification is unavailable. Try again shortly." },
        {
          status: 503,
          headers: PRIVATE_HEADERS,
        },
      );
    }
    if (!verdict.isHuman || verdict.isBot) {
      return Response.json(
        { error: "Browser verification failed. Reload and try again." },
        {
          status: 403,
          headers: PRIVATE_HEADERS,
        },
      );
    }
  }
  const response = await options.work(params);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
