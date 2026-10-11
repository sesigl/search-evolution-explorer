import { describe, expect, it } from "vitest";
import { positionDecay } from "./position-decay.ts";

describe("position decay", () => {
  it("Given a rank below 1, When decay is computed, Then the probability is 0", () => {
    expect(positionDecay(0)).toBe(0);
    expect(positionDecay(1)).toBe(1);
  });
});
