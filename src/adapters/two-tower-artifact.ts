import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "astro/zod";
import type { TwoTowerRetrieval } from "../domain/two-tower/model.ts";
import { projectVector } from "../domain/two-tower/projection.ts";
import type { TowerTrainingReport } from "../domain/two-tower/training-report.ts";
import type { PrerequisiteState } from "../domain/types/level.ts";

const vectorSchema = z.array(z.number().finite()).min(1);
const matrixSchema = z.array(vectorSchema).min(1);
const manifestSchema = z.object({
  version: z.literal(1),
  dimensions: z.number().int().positive(),
  inputDimensions: z.number().int().positive(),
  itemIds: z.array(z.string()).min(1),
  inputs: z.record(z.string(), z.string()),
  files: z.object({ "model.json": z.string(), "items.bin": z.string() }),
  splits: z.object({
    train: z.array(z.string()).min(1),
    validation: z.array(z.string()).min(1),
    test: z.array(z.string()).min(1),
  }),
  training: z.object({
    selectedEpoch: z.number().int().positive(),
    trainPairs: z.number().int().positive(),
    validationPairs: z.number().int().positive(),
    validationHistory: z
      .array(
        z.object({
          epoch: z.number().int().nonnegative(),
          validationLoss: z.number().finite().nonnegative(),
          validationNdcgAt10: z.number().min(0).max(1),
        }),
      )
      .min(1),
  }),
  calibration: z.object({
    measurements: z
      .array(
        z.object({
          name: z.string(),
          scoreWeight: z.number().finite(),
          retrievalLimit: z.number().int().positive(),
          ndcgAt10: z.number().min(0).max(1),
          mrr: z.number().min(0).max(1),
          recallAt50: z.number().min(0).max(1),
        }),
      )
      .min(1),
  }),
  ranking: z.object({
    scoreWeight: z.number().finite().nonnegative(),
    retrievalLimit: z.number().int().min(1).max(50),
  }),
  parity: z.object({ input: vectorSchema, output: vectorSchema }),
});
const modelSchema = z.object({ queryWeights: matrixSchema, itemWeights: matrixSchema });

interface TowerArtifact {
  readonly state: PrerequisiteState;
  readonly retrieval: TwoTowerRetrieval | null;
  readonly testQueries: readonly string[];
  readonly report: TowerTrainingReport | null;
}

/** A corrupt or mixed model/index pair must never serve as a trained chapter. */
export function loadTwoTowerArtifact(path: string): TowerArtifact {
  if (!existsSync(path)) {
    return { state: "missing", retrieval: null, testQueries: [], report: null };
  }
  try {
    const manifest = manifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const directory = dirname(path);
    verifyHashes(manifest.inputs);
    verifyHashes(
      Object.fromEntries(
        Object.entries(manifest.files).map(([name, hash]) => [join(directory, name), hash]),
      ),
    );
    const model = modelSchema.parse(
      JSON.parse(readFileSync(join(directory, "model.json"), "utf8")),
    );
    for (const matrix of [model.queryWeights, model.itemWeights]) {
      if (
        matrix.length !== manifest.dimensions ||
        matrix.some((row) => row.length !== manifest.inputDimensions)
      ) {
        throw new Error("Tower matrix dimensions do not match its index.");
      }
    }
    const queries = Object.values(manifest.splits).flat();
    if (new Set(queries).size !== queries.length) {
      throw new Error("Tower query splits overlap.");
    }
    const projected = projectVector(new Float32Array(manifest.parity.input), model.queryWeights);
    if (
      manifest.parity.output.length !== projected.length ||
      projected.some((value, i) => Math.abs(value - (manifest.parity.output[i] ?? 0)) > 1e-5)
    ) {
      throw new Error("Python and serving query projections disagree.");
    }
    const vectors = readItemVectors(
      join(directory, "items.bin"),
      manifest.itemIds,
      manifest.dimensions,
    );
    return {
      state: "ready",
      testQueries: manifest.splits.test,
      report: {
        selectedEpoch: manifest.training.selectedEpoch,
        trainPairs: manifest.training.trainPairs,
        validationPairs: manifest.training.validationPairs,
        queryCounts: {
          train: manifest.splits.train.length,
          validation: manifest.splits.validation.length,
          test: manifest.splits.test.length,
        },
        history: manifest.training.validationHistory,
        calibration: manifest.calibration.measurements,
      },
      retrieval: {
        queryWeights: model.queryWeights,
        scoreWeight: manifest.ranking.scoreWeight,
        retrievalLimit: manifest.ranking.retrievalLimit,
        itemVectors: {
          dimensions: () => manifest.dimensions,
          itemIds: () => manifest.itemIds,
          getVector: (id) => vectors.get(id),
        },
      },
    };
  } catch {
    return { state: "stale", retrieval: null, testQueries: [], report: null };
  }
}

function verifyHashes(hashes: Readonly<Record<string, string>>): void {
  if (Object.keys(hashes).length === 0) {
    throw new Error("Missing tower provenance.");
  }
  for (const [path, expected] of Object.entries(hashes)) {
    const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (actual !== expected) {
      throw new Error(`Tower input changed: ${path}`);
    }
  }
}

function readItemVectors(
  path: string,
  itemIds: readonly string[],
  dimensions: number,
): ReadonlyMap<string, Float32Array> {
  const raw = readFileSync(path);
  if (
    raw.byteLength !== itemIds.length * dimensions * 4 ||
    new Set(itemIds).size !== itemIds.length
  ) {
    throw new Error("Tower item index size or IDs are invalid.");
  }
  const vectors = new Map<string, Float32Array>();
  for (const [row, id] of itemIds.entries()) {
    const vector = Float32Array.from({ length: dimensions }, (_, col) =>
      raw.readFloatLE((row * dimensions + col) * 4),
    );
    const norm = vector.reduce((sum, value) => sum + value * value, 0);
    if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-4) {
      throw new Error("Tower item vector is not unit length.");
    }
    vectors.set(id, vector);
  }
  return vectors;
}
