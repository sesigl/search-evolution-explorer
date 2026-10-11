import { describe, expect, it } from "vitest";
import { uniqueQueryTexts } from "./unique-query-texts.ts";

describe("unique query texts", () => {
  it("Given repeated judgments, When unique query texts are collected, Then each query appears once", () => {
    expect(
      uniqueQueryTexts([
        { queryText: "sofa", itemId: "a", grade: 3 },
        { queryText: "lamp", itemId: "b", grade: 1 },
        { queryText: "sofa", itemId: "c", grade: 0 },
      ]),
    ).toEqual(["sofa", "lamp"]);
  });

  it("Given no judgments, When unique query texts are collected, Then the list is empty", () => {
    expect(uniqueQueryTexts([])).toEqual([]);
  });
});
