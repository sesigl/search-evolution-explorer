import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { env, pipeline } from "@huggingface/transformers";
import { readJudgments, readSessions } from "../src/adapters/artifact-json.ts";
import { createFileCorpusSource } from "../src/adapters/file-corpus-source.ts";
import { createTransformersQueryEncoder } from "../src/adapters/transformers-query-encoder.ts";
import { queryTextForEncoding } from "../src/domain/query-understanding/understand.ts";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
/** Titles per forward pass. The catalog is ~43k items, so batching matters. */
const TITLE_BATCH = 64;

// Split before creating supervision. Test labels are never written to the training input.
const sessions = readSessions("data/clicks.ndjson");
const queries = [
  ...new Set(sessions.map((session) => queryTextForEncoding(session.queryText))),
].sort();
const encoder = await createTransformersQueryEncoder(".cache");
const encoded: { query: string; vector: number[]; split: string }[] = [];
for (const query of queries) {
  const bucket =
    Number.parseInt(createHash("sha256").update(query).digest("hex").slice(0, 8), 16) % 10;
  // biome-ignore lint/performance/noAwaitInLoops: bound local model inference memory
  const vector = await encoder.encode(query);
  encoded.push({
    query,
    vector: [...vector],
    split: bucket < 7 ? "train" : bucket === 7 ? "validation" : "test",
  });
}
const inputs = Object.fromEntries(
  [
    "data/corpus.ndjson",
    "data/clicks.ndjson",
    "data/logged-ranking.ndjson",
    "data/clicks.manifest.json",
    "data/embeddings.bin",
    "data/embeddings.manifest.json",
    "data/judgments.ndjson",
  ].map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]),
);
const developmentQueries = new Set(
  encoded.filter((row) => row.split !== "test").map((row) => row.query),
);
const judgments = readJudgments("data/judgments.ndjson")
  .map((row) => ({ ...row, queryText: queryTextForEncoding(row.queryText) }))
  .filter((row) => developmentQueries.has(row.queryText));
const items = await createFileCorpusSource("data/corpus.ndjson").readItems();

env.cacheDir = ".cache";
env.allowRemoteModels = false;
const extractor = await pipeline("feature-extraction", MODEL_ID, {
  // biome-ignore lint/style/useNamingConvention: transformers.js requires cache_dir
  cache_dir: ".cache",
});
const titles: number[][] = [];
for (let start = 0; start < items.length; start += TITLE_BATCH) {
  const texts = items.slice(start, start + TITLE_BATCH).map((item) => item.title);
  // biome-ignore lint/performance/noAwaitInLoops: one await per batch, not per title
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  for (const row of output.tolist() as number[][]) {
    titles.push(row);
  }
  if (start % (TITLE_BATCH * 50) === 0) {
    process.stdout.write(`Encoded ${titles.length}/${items.length} titles\n`);
  }
}
mkdirSync(".cache/two-tower", { recursive: true });
writeFileSync(
  ".cache/two-tower/training.json",
  JSON.stringify({
    inputs,
    queries: encoded,
    judgments,
    titles,
  }),
);
process.stdout.write(
  `Prepared ${queries.length} query groups from ${sessions.length} simulated sessions.\n`,
);
