import process from "node:process";
import { env } from "@huggingface/transformers";
import { createTransformersCrossEncoder } from "../src/adapters/transformers-cross-encoder.ts";
import {
  CROSS_ENCODER_MODEL_ID,
  CROSS_ENCODER_REVISION,
} from "../src/domain/cross-encoder/model-spec.ts";

env.allowRemoteModels = true;
const encoder = await createTransformersCrossEncoder(".cache", false);
const scores = await encoder.scorePairs("bicycle", ["A used bicycle.", "A kitchen table."]);
if (scores.length !== 2 || !scores.every(Number.isFinite)) {
  throw new Error("Cross-encoder smoke check failed: expected two finite relevance scores.");
}
process.stdout.write(
  `Cross-encoder ready: ${CROSS_ENCODER_MODEL_ID} at ${CROSS_ENCODER_REVISION}.\n`,
);
