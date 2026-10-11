export interface VectorStore {
  getVector(itemId: string): Float32Array | undefined;
  itemIds(): readonly string[];
  dimensions(): number;
}
