/** Rows are output dimensions; columns are frozen text-encoder dimensions. */
export function projectVector(
  input: Float32Array,
  weights: readonly (readonly number[])[],
): Float32Array {
  if (!weights.every((row) => row.length === input.length)) {
    throw new Error("Tower projection dimensions do not match the text encoder.");
  }
  const output = new Float32Array(weights.length);
  for (const [rowIndex, row] of weights.entries()) {
    let sum = 0;
    for (const [column, weight] of row.entries()) {
      sum += weight * (input[column] ?? 0);
    }
    output[rowIndex] = sum;
  }
  const norm = Math.sqrt(output.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Tower projection must produce a finite, nonzero vector.");
  }
  return output.map((value) => value / norm);
}
