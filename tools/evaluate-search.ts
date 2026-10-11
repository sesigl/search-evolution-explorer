import { mkdirSync, writeFileSync } from "node:fs";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import process from "node:process";
import type { Scorecard } from "../src/domain/types/evaluation.ts";
import { checkChapterSix } from "./check-chapter-six.ts";
import { checkGuidedExamples } from "./check-guided-examples.ts";

const baseUrl = process.argv[2] ?? "http://localhost:4321";
const scorecard = JSON.parse(
  await readScorecard(new URL("/api/scorecard.json", baseUrl)),
) as Scorecard;
mkdirSync("reports/qa", { recursive: true });
writeFileSync("reports/qa/search-evaluation.json", `${JSON.stringify(scorecard, null, 2)}\n`);
// biome-ignore lint/suspicious/noConsole: this CLI prints the evaluation table
console.table(
  scorecard.runs.map((run) => ({
    chapter: run.levelId,
    queries: run.perQuery.length,
    ndcgAt10: run.ndcgAt10.toFixed(4),
    mrr: run.mrr.toFixed(4),
    recallAt50: run.recallAt50.toFixed(4),
    p50Ms: run.msPerQueryP50,
    p95Ms: run.msPerQueryP95,
  })),
);
const tower = scorecard.runs.find((run) => run.levelId === "level-6-two-tower");
if (tower === undefined || scorecard.heldOut === undefined) {
  throw new Error(
    "Chapter 11 and its held-out split must be ready. Run npm run data:two-tower and restart the app.",
  );
}
process.stdout.write(
  `Chapter 11 regressions: ${scorecard.regressions.filter((row) => row.levelId === tower.levelId).length}/${tower.perQuery.length}. Held-out results (same serving runs):\n`,
);
// biome-ignore lint/suspicious/noConsole: this CLI prints measured results
console.table(
  scorecard.heldOut.runs.map((run) => ({
    chapter: run.levelId,
    queries: run.perQuery.length,
    ndcgAt10: run.ndcgAt10,
    mrr: run.mrr,
    recallAt50: run.recallAt50,
  })),
);
for (const run of [...scorecard.runs, ...scorecard.heldOut.runs]) {
  if (
    run.perQuery.length === 0 ||
    ![run.ndcgAt10, run.mrr, run.recallAt50].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    )
  ) {
    throw new Error(`Invalid or empty evaluation for ${run.levelId}`);
  }
}
const baseline = scorecard.runs.find((run) => run.levelId === "level-4-hybrid");
const cross = scorecard.runs.find((run) => run.levelId === "level-5-cross-encoder");
if (baseline === undefined || cross === undefined) {
  throw new Error("Chapters 9 and 10 must be ready. Run npm run data:all and restart the app.");
}
if (
  tower.ndcgAt10 <= cross.ndcgAt10 ||
  tower.mrr < cross.mrr ||
  tower.recallAt50 < cross.recallAt50
) {
  throw new Error(
    "Chapter 11 must improve overall NDCG@10 without lowering MRR or Recall@50. Inspect the recorded regressions before changing the model.",
  );
}

function readScorecard(url: URL): Promise<string> {
  // Full local neural evaluation can exceed fetch's fixed five-minute header timeout.
  return new Promise((resolve, reject) => {
    const get = url.protocol === "https:" ? httpsGet : httpGet;
    const request = get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("error", reject);
      response.on("end", () => {
        if (response.statusCode === 200) {
          resolve(body);
        } else {
          reject(new Error(`Scorecard failed (${response.statusCode}): ${body}`));
        }
      });
    });
    request.setTimeout(900_000, () => request.destroy(new Error("Scorecard exceeded 15 minutes.")));
    request.on("error", reject);
  });
}
process.stdout.write(
  `Chapter 10 regressions: ${scorecard.regressions.filter((row) => row.levelId === cross.levelId).length}/${cross.perQuery.length}. Full results: reports/qa/search-evaluation.json\n`,
);
if (
  cross.ndcgAt10 <= baseline.ndcgAt10 ||
  cross.mrr < baseline.mrr ||
  Math.abs(cross.recallAt50 - baseline.recallAt50) > 1e-12
) {
  throw new Error(
    "Chapter 10 quality check failed: NDCG must improve, MRR must not fall, and the same 50 candidates must preserve recall.",
  );
}
await checkChapterSix(baseUrl, scorecard);
await checkGuidedExamples(baseUrl);
