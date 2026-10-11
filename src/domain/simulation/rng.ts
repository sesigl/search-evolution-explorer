const MODULUS = 2_147_483_647;
const MULTIPLIER = 16_807;

export function createRng(seed: number): () => number {
  let state = seed % MODULUS;
  if (state <= 0) {
    state += MODULUS - 1;
  }
  return () => {
    state = (state * MULTIPLIER) % MODULUS;
    return (state - 1) / (MODULUS - 1);
  };
}
