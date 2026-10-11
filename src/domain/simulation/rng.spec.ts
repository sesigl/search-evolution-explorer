import { describe, expect, it } from "vitest";
import { createRng } from "./rng.ts";

describe("click simulator rng", () => {
  it("Given a non-positive seed, When samples are drawn, Then each value stays in the unit range", () => {
    const rng = createRng(0);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
