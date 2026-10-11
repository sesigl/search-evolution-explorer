import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { env, pipeline } from "@huggingface/transformers";
import { hashContent } from "../src/domain/artifacts/manifest.ts";
import type { CorpusItem } from "../src/domain/types/corpus.ts";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
/** Texts per forward pass. Batching keeps the catalog build to minutes, not hours. */
const BATCH_SIZE = 64;
const CORPUS_PATH = resolve("data/corpus.ndjson");
const BIN_PATH = resolve("data/embeddings.bin");
const MANIFEST_PATH = resolve("data/embeddings.manifest.json");

function readCorpus(path: string): CorpusItem[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as CorpusItem);
}

function textsOf(items: readonly CorpusItem[], start: number): string[] {
  return items.slice(start, start + BATCH_SIZE).map((item) => `${item.title} ${item.description}`);
}

env.cacheDir = ".cache";
env.allowRemoteModels = true;
const items = readCorpus(CORPUS_PATH);
const extractor = await pipeline("feature-extraction", MODEL_ID, {
  // biome-ignore lint/style/useNamingConvention: transformers.js requires cache_dir
  cache_dir: ".cache",
});

const vectors: Float32Array[] = [];
for (let start = 0; start < items.length; start += BATCH_SIZE) {
  // biome-ignore lint/performance/noAwaitInLoops: one await per batch, not per item
  const output = await extractor(textsOf(items, start), { pooling: "mean", normalize: true });
  for (const row of output.tolist() as number[][]) {
    vectors.push(Float32Array.from(row));
  }
  if (start % (BATCH_SIZE * 50) === 0) {
    process.stdout.write(`Encoded ${vectors.length}/${items.length}\n`);
  }
}

const dimensions = vectors[0]?.length ?? 0;
const packed = new Float32Array(items.length * dimensions);
for (const [index, vector] of vectors.entries()) {
  packed.set(vector, index * dimensions);
}
mkdirSync(dirname(BIN_PATH), { recursive: true });
writeFileSync(BIN_PATH, Buffer.from(packed.buffer));
writeFileSync(
  MANIFEST_PATH,
  `${JSON.stringify(
    {
      itemIds: items.map((item) => item.id),
      dimensions,
      modelId: MODEL_ID,
      corpusHash: hashContent(readFileSync(CORPUS_PATH, "utf8")),
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`Wrote ${items.length} embeddings of ${dimensions} dimensions.\n`);
