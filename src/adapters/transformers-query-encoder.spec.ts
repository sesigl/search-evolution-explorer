import { describe, expect, it } from "vitest";
import { embeddingToVector, serialQueue } from "./transformers-query-encoder.ts";

describe("embedding output conversion", () => {
  it("Given a nested list output, When it is converted, Then the inner vector is returned", () => {
    expect(embeddingToVector({ tolist: () => [[0.1, 0.2]] })).toEqual([0.1, 0.2]);
    expect(embeddingToVector({ tolist: () => [0.3, 0.4] })).toEqual([0.3, 0.4]);
  });

  it("Given an unexpected shape, When it is converted, Then conversion fails", () => {
    expect(() => embeddingToVector(null)).toThrow("Unexpected embedding output shape.");
    expect(() => embeddingToVector({ tolist: () => [["x"]] })).toThrow(
      "Unexpected embedding output shape.",
    );
  });
});

describe("serialQueue", () => {
  it("Given two jobs, When both are queued at once, Then they run one after another in order", async () => {
    const run = serialQueue();
    const events: string[] = [];
    const slow = run(async () => {
      events.push("slow start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("slow end");
      return "slow";
    });
    const fast = run(async () => {
      events.push("fast");
      return "fast";
    });
    expect(await Promise.all([slow, fast])).toEqual(["slow", "fast"]);
    expect(events).toEqual(["slow start", "slow end", "fast"]);
  });

  it("Given a failing job, When the next job is queued, Then the queue keeps running", async () => {
    const run = serialQueue();
    await expect(run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await run(() => Promise.resolve(1))).toBe(1);
  });
});
