import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBinaryVectorStore } from "./binary-vector-store.ts";

describe("binary vector store", () => {
  it("Given a Float32 file and manifest, When a vector is read, Then the stored values are returned", () => {
    const directory = mkdtempSync(join(tmpdir(), "embeddings-"));
    const binPath = join(directory, "embeddings.bin");
    const manifestPath = join(directory, "embeddings.manifest.json");
    const values = Float32Array.from([1, 0, 0, 1]);
    writeFileSync(binPath, Buffer.from(values.buffer));
    writeFileSync(manifestPath, JSON.stringify({ itemIds: ["a", "b"], dimensions: 2 }));
    const store = createBinaryVectorStore(binPath, manifestPath);
    expect([...(store.getVector("a") ?? [])]).toEqual([1, 0]);
    expect([...(store.getVector("b") ?? [])]).toEqual([0, 1]);
    expect(store.dimensions()).toBe(2);
  });

  it("Given a manifest that is not an embedding manifest, When the store is created, Then the file is rejected", () => {
    const directory = mkdtempSync(join(tmpdir(), "embeddings-"));
    const binPath = join(directory, "embeddings.bin");
    const manifestPath = join(directory, "embeddings.manifest.json");
    writeFileSync(binPath, Buffer.from(Float32Array.from([1, 0]).buffer));
    writeFileSync(manifestPath, JSON.stringify({ itemIds: "a" }));
    expect(() => createBinaryVectorStore(binPath, manifestPath)).toThrow(/malformed/i);
  });
});
