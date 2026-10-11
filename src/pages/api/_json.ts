import { UseCaseError } from "../../domain/search/errors.ts";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

/** Runs a use case and answers JSON; a UseCaseError becomes a 400 or 503 with an `error` field. */
export async function respondJson(work: () => Promise<unknown>): Promise<Response> {
  try {
    return new Response(JSON.stringify(await work()), { headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof UseCaseError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.code === "BAD_REQUEST" ? 400 : 503,
        headers: JSON_HEADERS,
      });
    }
    throw error;
  }
}
