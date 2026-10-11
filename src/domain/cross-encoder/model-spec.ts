/** Pin the pretrained model so setup and evaluation use the same weights and tokenizer. */
export const CROSS_ENCODER_MODEL_ID = "Xenova/ms-marco-MiniLM-L-6-v2";
export const CROSS_ENCODER_REVISION = "a09144355adeed5f58c8ed011d209bf8ee5a1fec";
export const CROSS_ENCODER_ARTIFACT_PATH = `.cache/${CROSS_ENCODER_MODEL_ID}/${CROSS_ENCODER_REVISION}/onnx/model_quantized.onnx`;
