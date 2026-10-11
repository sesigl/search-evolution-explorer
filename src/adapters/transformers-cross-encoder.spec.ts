import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransformersCrossEncoder } from "./transformers-cross-encoder.ts";

const { tokenize, infer } = vi.hoisted(() => ({ tokenize: vi.fn(), infer: vi.fn() }));
vi.mock("@huggingface/transformers", () => ({
  AutoTokenizer: { from_pretrained: async () => tokenize },
  AutoModelForSequenceClassification: { from_pretrained: async () => infer },
}));

beforeEach(() => {
  vi.resetAllMocks();
  tokenize.mockImplementation((queries, options) => ({ queries, documents: options.text_pair }));
  infer.mockImplementation(async ({ documents }: { documents: string[] }) => ({
    logits: { data: Float32Array.from(documents.map(Number)) },
  }));
});

describe("local cross-encoder inference", () => {
  it("tokenizes paired texts in bounded batches and preserves raw score order across batches", async () => {
    const encoder = await createTransformersCrossEncoder(".cache", true);
    const documents = Array.from({ length: 10 }, (_, index) => String(index - 5));
    expect(await encoder.scorePairs("cable", documents)).toEqual([
      -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
    ]);
    expect(tokenize).toHaveBeenCalledTimes(2);
    expect(tokenize).toHaveBeenNthCalledWith(1, Array(8).fill("cable"), {
      text_pair: documents.slice(0, 8),
      padding: true,
      truncation: true,
      max_length: 256,
    });
    expect(tokenize).toHaveBeenNthCalledWith(2, ["cable", "cable"], {
      text_pair: documents.slice(8),
      padding: true,
      truncation: true,
      max_length: 256,
    });
  });

  it("shares identical in-flight requests but serializes different inputs", async () => {
    const events: string[] = [];
    infer.mockImplementation(async ({ queries }: { queries: string[] }) => {
      const query = queries[0] as string;
      events.push(`start ${query}`);
      await Promise.resolve();
      events.push(`end ${query}`);
      return { logits: { data: Float32Array.from([1]) } };
    });
    const encoder = await createTransformersCrossEncoder(".cache", true);
    const first = encoder.scorePairs("first", ["1"]);
    expect(encoder.scorePairs("first", ["1"])).toBe(first);
    await Promise.all([first, encoder.scorePairs("second", ["1"])]);
    expect(events).toEqual(["start first", "end first", "start second", "end second"]);
    expect(infer).toHaveBeenCalledTimes(2);
    await encoder.scorePairs("first", ["2"]);
    expect(infer).toHaveBeenCalledTimes(3);
  });

  it("evicts failed requests so retry succeeds without breaking the inference queue", async () => {
    infer.mockRejectedValueOnce(new Error("inference failed"));
    const encoder = await createTransformersCrossEncoder(".cache", true);
    await expect(encoder.scorePairs("cable", ["3"])).rejects.toThrow("inference failed");
    expect(await encoder.scorePairs("cable", ["3"])).toEqual([3]);
    expect(infer).toHaveBeenCalledTimes(2);
  });
});
