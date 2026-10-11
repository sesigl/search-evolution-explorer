export interface QueryEncoder {
  encode(text: string): Promise<Float32Array>;
}
