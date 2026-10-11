import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTwoTowerArtifact } from "./two-tower-artifact.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function bundle() {
  const directory = mkdtempSync(join(tmpdir(), "tower-test-"));
  directories.push(directory);
  const input = join(directory, "corpus.txt");
  writeFileSync(input, "inventory");
  const weights = [
    [1, 0],
    [0, 1],
  ];
  writeFileSync(
    join(directory, "model.json"),
    JSON.stringify({ queryWeights: weights, itemWeights: weights }),
  );
  writeFileSync(join(directory, "items.bin"), Buffer.from(new Float32Array([1, 0]).buffer));
  const hash = (filePath: string) =>
    createHash("sha256").update(readFileSync(filePath)).digest("hex");
  const manifest = {
    version: 1,
    dimensions: 2,
    inputDimensions: 2,
    itemIds: ["item"],
    inputs: { [input]: hash(input) },
    files: {
      "model.json": hash(join(directory, "model.json")),
      "items.bin": hash(join(directory, "items.bin")),
    },
    splits: { train: ["train"], validation: ["validation"], test: ["test"] },
    training: {
      selectedEpoch: 1,
      trainPairs: 2,
      validationPairs: 1,
      validationHistory: [{ epoch: 1, validationLoss: 0.4, validationNdcgAt10: 0.8 }],
    },
    calibration: {
      measurements: [
        {
          name: "trained",
          scoreWeight: 0,
          retrievalLimit: 50,
          ndcgAt10: 0.8,
          mrr: 1,
          recallAt50: 1,
        },
      ],
    },
    ranking: { scoreWeight: 0, retrievalLimit: 50 },
    parity: { input: [3, 4], output: [0.6, 0.8] },
  };
  const path = join(directory, "manifest.json");
  const save = () => writeFileSync(path, JSON.stringify(manifest));
  save();
  return { directory, input, manifest, path, save, hash };
}

describe("trained model and item index bundle", () => {
  it("Given compatible weights and indexed vectors, When loaded, Then serving passes the exported projection parity check", () => {
    const data = bundle();
    const loaded = loadTwoTowerArtifact(data.path);
    expect(loaded.state).toBe("ready");
    expect(loaded.testQueries).toEqual(["test"]);
    expect(loaded.retrieval?.itemVectors.getVector("item")).toEqual(new Float32Array([1, 0]));
    expect(loaded.retrieval?.itemVectors.dimensions()).toBe(2);
    expect(loaded.retrieval?.itemVectors.itemIds()).toEqual(["item"]);
  });
  it("Given a changed inventory, When loaded, Then the old learned index is stale", () => {
    const data = bundle();
    writeFileSync(data.input, "new inventory");
    expect(loadTwoTowerArtifact(data.path)).toEqual({
      state: "stale",
      retrieval: null,
      testQueries: [],
      report: null,
    });
  });
  it.each(["dimensions", "overlap", "parity", "ids", "untrained", "weights"])(
    "Given a broken %s contract, When loaded, Then the chapter is unavailable",
    (problem) => {
      const data = bundle();
      if (problem === "dimensions") {
        data.manifest.dimensions = 3;
      }
      if (problem === "overlap") {
        data.manifest.splits.test = ["train"];
      }
      if (problem === "parity") {
        data.manifest.parity.output = [1, 0];
      }
      if (problem === "ids") {
        data.manifest.itemIds.push("item");
      }
      if (problem === "untrained") {
        data.manifest.training.selectedEpoch = 0;
      }
      if (problem === "weights") {
        writeFileSync(
          join(data.directory, "model.json"),
          JSON.stringify({ queryWeights: [[1]], itemWeights: [[1]] }),
        );
        data.manifest.files["model.json"] = data.hash(join(data.directory, "model.json"));
      }
      data.save();
      expect(loadTwoTowerArtifact(data.path).state).toBe("stale");
    },
  );
  it.each([true, false])(
    "Given a zero vector with updated checksum %s, When loaded, Then the bundle is stale",
    (updateHash) => {
      const data = bundle();
      writeFileSync(
        join(data.directory, "items.bin"),
        Buffer.from(new Float32Array([0, 0]).buffer),
      );
      if (updateHash) {
        data.manifest.files["items.bin"] = data.hash(join(data.directory, "items.bin"));
      }
      data.save();
      expect(loadTwoTowerArtifact(data.path).state).toBe("stale");
    },
  );
  it("Given no bundle, When loaded, Then the artifact is missing", () => {
    const data = bundle();
    expect(loadTwoTowerArtifact(join(data.directory, "absent.json")).state).toBe("missing");
  });
});
