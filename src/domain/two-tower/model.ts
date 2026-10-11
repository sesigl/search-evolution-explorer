import type { VectorStore } from "../ports/vector-store.ts";

export const TWO_TOWER_PATH = "data/models/two-tower/manifest.json";

export interface TwoTowerRetrieval {
  readonly queryWeights: readonly (readonly number[])[];
  readonly itemVectors: VectorStore;
  readonly scoreWeight: number;
  readonly retrievalLimit: number;
}
