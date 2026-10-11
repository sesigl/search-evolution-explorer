import { describe, expect, it } from "vitest";
import { projectVector } from "./projection.ts";

describe("independent tower projection", () => {
  it.each([
    [new Float32Array([1]), [[1, 2]]],
    [new Float32Array([Number.NaN]), [[1]]],
    [new Float32Array([1]), [[0]]],
    [new Float32Array([1]), []],
  ])(
    "Given incompatible or degenerate vectors, When projected, Then serving fails explicitly",
    (input, weights) => {
      expect(() => projectVector(input, weights)).toThrow("projection");
    },
  );
  it("Given a text vector and a trained head, When encoded, Then the matrix product is unit normalized", () => {
    expect([
      ...projectVector(new Float32Array([2, 3]), [
        [3, 0],
        [0, 0],
      ]),
    ]).toEqual([1, 0]);
    const projected = projectVector(new Float32Array([1, 1]), [
      [3, 0],
      [0, 4],
    ]);
    expect(projected[0]).toBeCloseTo(0.6);
    expect(projected[1]).toBeCloseTo(0.8);
  });
});
