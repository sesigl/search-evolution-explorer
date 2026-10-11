import { AutoModelForSequenceClassification, AutoTokenizer } from "@huggingface/transformers";
import {
  CROSS_ENCODER_MODEL_ID,
  CROSS_ENCODER_REVISION,
} from "../domain/cross-encoder/model-spec.ts";
import type { CrossEncoder } from "../domain/ports/cross-encoder.ts";

const BATCH_SIZE = 8;
const MAX_TOKENS = 256;
const CACHE_SIZE = 64;

export async function createTransformersCrossEncoder(
  cacheDir: string,
  localFilesOnly: boolean,
): Promise<CrossEncoder> {
  const options = {
    revision: CROSS_ENCODER_REVISION,
    // biome-ignore lint/style/useNamingConvention: external library option
    cache_dir: cacheDir,
    // biome-ignore lint/style/useNamingConvention: external library option
    local_files_only: localFilesOnly,
  };
  const tokenizer = await AutoTokenizer.from_pretrained(CROSS_ENCODER_MODEL_ID, options);
  const model = await AutoModelForSequenceClassification.from_pretrained(CROSS_ENCODER_MODEL_ID, {
    ...options,
    dtype: "q8",
    // biome-ignore lint/style/useNamingConvention: external library option
    session_options: { intraOpNumThreads: 2 },
  });
  // Serialize ONNX calls. Cache exact input pairs so paging does not repeat neural inference.
  let pending: Promise<unknown> = Promise.resolve();
  const cache = new Map<string, Promise<readonly number[]>>();
  async function infer(query: string, documents: readonly string[]): Promise<readonly number[]> {
    const scores: number[] = [];
    for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
      const batch = documents.slice(offset, offset + BATCH_SIZE);
      const inputs = tokenizer(
        batch.map(() => query),
        {
          // biome-ignore lint/style/useNamingConvention: external library option
          text_pair: batch,
          padding: true,
          truncation: true,
          // biome-ignore lint/style/useNamingConvention: external library option
          max_length: MAX_TOKENS,
        },
      );
      // biome-ignore lint/performance/noAwaitInLoops: bounded batches keep inference memory and latency stable
      const output = await model(inputs);
      scores.push(...Array.from(output.logits.data, Number));
    }
    return scores;
  }
  return {
    scorePairs(query, documents) {
      const key = JSON.stringify([query, documents]);
      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const result = pending.then(() => infer(query, documents));
      pending = result.catch(() => {
        cache.delete(key);
      });
      cache.set(key, result);
      if (cache.size > CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      return result;
    },
  };
}
