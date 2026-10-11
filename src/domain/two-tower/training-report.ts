export interface TowerTrainingReport {
  readonly selectedEpoch: number;
  readonly trainPairs: number;
  readonly validationPairs: number;
  readonly queryCounts: {
    readonly train: number;
    readonly validation: number;
    readonly test: number;
  };
  readonly history: readonly {
    readonly epoch: number;
    readonly validationLoss: number;
    readonly validationNdcgAt10: number;
  }[];
  readonly calibration: readonly {
    readonly name: string;
    readonly scoreWeight: number;
    readonly retrievalLimit: number;
    readonly ndcgAt10: number;
    readonly mrr: number;
    readonly recallAt50: number;
  }[];
}
