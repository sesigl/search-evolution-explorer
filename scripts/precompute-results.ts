/**
 * Compute the results that are too slow for one serverless request: the full scorecard, the
 * early-chapter scorecard and the position-bias lesson. The deployed app serves them from
 * data/precomputed/results.json while its fingerprint matches the current code and data.
 * When the fingerprint does not match, the app computes them live and logs a warning.
 *
 * The app code needs Vite to load, so this asks a running dev server.
 *
 * Run (with `npm run dev` in another terminal):
 *   npm run data:precompute
 *   npm run data:precompute -- http://localhost:4321
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { dirname } from "node:path";
import process from "node:process";

const OUTPUT_PATH = "data/precomputed/results.json";
const baseUrl = process.argv[2] ?? "http://localhost:4321";

const body = await readBody(new URL("/api/precomputed.json", baseUrl));
const results = JSON.parse(body) as { fingerprint?: unknown };
if (typeof results.fingerprint !== "string") {
  throw new Error(`The dev server answered without a fingerprint: ${body.slice(0, 200)}`);
}
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(results)}\n`);
process.stdout.write(`Wrote ${OUTPUT_PATH} (fingerprint ${results.fingerprint.slice(0, 12)}).\n`);

function readBody(url: URL): Promise<string> {
  // The computation takes longer than fetch's fixed five-minute header timeout.
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        text += chunk;
      });
      response.on("end", () => {
        if (response.statusCode === 200) {
          resolve(text);
        } else {
          reject(new Error(`${response.statusCode} from ${url}: ${text.slice(0, 200)}`));
        }
      });
    });
    request.on("error", reject);
  });
}
