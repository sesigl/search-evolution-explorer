import { env, pipeline } from "@huggingface/transformers";
import type { QueryEncoder } from "../domain/ports/query-encoder.ts";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export async function createTransformersQueryEncoder(cacheDir: string): Promise<QueryEncoder> {
  env.cacheDir = cacheDir;
  env.allowRemoteModels = false;
  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    // biome-ignore lint/style/useNamingConvention: transformers.js requires cache_dir
    cache_dir: cacheDir,
  });
  // Concurrent calls into the pipeline returned different vectors for the same text.
  const oneAtATime = serialQueue();
  return {
    encode(text: string): Promise<Float32Array> {
      return oneAtATime(async () => {
        const output = await extractor(text, { pooling: "mean", normalize: true });
        return Float32Array.from(embeddingToVector(output));
      });
    },
  };
}

export function embeddingToVector(output: unknown): number[] {
  const listed = listedEmbedding(output);
  if (Array.isArray(listed) && listed.length > 0) {
    const nested = numberList(listed[0]);
    if (nested !== undefined) {
      return nested;
    }
  }
  const flat = numberList(listed);
  if (flat !== undefined) {
    return flat;
  }
  throw new Error("Unexpected embedding output shape.");
}

function listedEmbedding(output: unknown): unknown {
  if (output === null || typeof output !== "object") {
    return undefined;
  }
  if (!("tolist" in output)) {
    return undefined;
  }
  const method = output.tolist;
  if (typeof method !== "function") {
    return undefined;
  }
  return method.call(output);
}

function numberList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const numbers: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number") {
      return undefined;
    }
    numbers.push(entry);
  }
  return numbers;
}

/**
 * Runs asynchronous jobs one after another. The transformers.js pipeline is not safe to call
 * while another call is in flight: two concurrent encodes of the same text gave two
 * different vectors, so the encoder queues every call through this.
 */
export function serialQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (job) => {
    const run = tail.then(job);
    tail = run.catch(() => undefined);
    return run;
  };
}
