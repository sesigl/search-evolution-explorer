import { readFileSync } from "node:fs";
import type { VectorStore } from "../domain/ports/vector-store.ts";

interface EmbeddingManifest {
  readonly itemIds: readonly string[];
  readonly dimensions: number;
}

export function createBinaryVectorStore(binPath: string, manifestPath: string): VectorStore {
  const manifest = parseManifest(readFileSync(manifestPath, "utf8"), manifestPath);
  const raw = readFileSync(binPath);
  const floats = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const dimensions = manifest.dimensions;
  const vectors = new Map<string, Float32Array>();
  for (const [index, itemId] of manifest.itemIds.entries()) {
    const start = index * dimensions;
    vectors.set(itemId, floats.slice(start, start + dimensions));
  }
  return {
    getVector(itemId) {
      return vectors.get(itemId);
    },
    itemIds() {
      return manifest.itemIds;
    },
    dimensions() {
      return dimensions;
    },
  };
}

function parseManifest(raw: string, manifestPath: string): EmbeddingManifest {
  const parsed: unknown = JSON.parse(raw);
  if (!isEmbeddingManifest(parsed)) {
    throw new Error(`Malformed embedding manifest: ${manifestPath}`);
  }
  return parsed;
}

function isEmbeddingManifest(value: unknown): value is EmbeddingManifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const itemIds = record["itemIds"];
  const dimensions = record["dimensions"];
  return (
    Array.isArray(itemIds) &&
    itemIds.every((itemId) => typeof itemId === "string") &&
    typeof dimensions === "number" &&
    Number.isInteger(dimensions) &&
    dimensions > 0
  );
}
