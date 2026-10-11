import { describe, expect, it } from "vitest";
import type { RankedResult } from "../types/ranking.ts";
import { evaluateGuidedExample } from "./guided-example.ts";

function result(id: string, position: number): RankedResult {
  return {
    item: {
      id,
      title: id,
      description: "",
      categoryId: "furniture",
      priceCents: 1,
      location: "Berlin",
      postedAt: "2026-01-01T00:00:00.000Z",
      available: true,
    },
    position,
    score: 10 - position,
    signals: [],
  };
}

describe("guided example evaluation", () => {
  it("Given an item that only the higher level retrieves, When itemEnters is checked, Then the assertion passes", () => {
    expect(
      evaluateGuidedExample("itemEnters", "sofa", [result("sofa", 1)], [result("chair", 1)]),
    ).toBe(true);
    expect(
      evaluateGuidedExample("itemEnters", "sofa", [result("chair", 1)], [result("chair", 1)]),
    ).toBe(false);
  });

  it("Given an item that only the lower level retrieves, When itemExits is checked, Then the assertion passes", () => {
    expect(
      evaluateGuidedExample("itemExits", "noise", [result("sofa", 1)], [result("noise", 1)]),
    ).toBe(true);
  });

  it("Given a rank change in the top 10, When rankChangeInTop10 is checked, Then the assertion passes only while the difference remains", () => {
    expect(
      evaluateGuidedExample(
        "rankChangeInTop10",
        "golf",
        [result("golf", 1), result("other", 2)],
        [result("other", 1), result("golf", 2)],
      ),
    ).toBe(true);
    expect(
      evaluateGuidedExample("rankChangeInTop10", "golf", [result("golf", 1)], [result("golf", 1)]),
    ).toBe(false);
    expect(
      evaluateGuidedExample("rankChangeInTop10", null, [result("a", 1)], [result("b", 1)]),
    ).toBe(true);
  });
});
