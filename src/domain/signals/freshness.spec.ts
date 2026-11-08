import { describe, expect, it } from "vitest";
import { freshnessScore, snapshotInstant } from "./freshness.ts";

const reference = Date.parse("2026-09-09T00:00:00.000Z");

describe("freshness", () => {
  it("Given a listing posted at the reference instant, When freshness is computed, Then it is one", () => {
    expect(freshnessScore("2026-09-09T00:00:00.000Z", reference, 7)).toBe(1);
  });

  it("Given a listing one half-life old, When freshness is computed, Then it is one half", () => {
    expect(freshnessScore("2026-09-02T00:00:00.000Z", reference, 7)).toBe(0.5);
  });

  it("Given a listing posted after the reference instant, When freshness is computed, Then it is capped at one", () => {
    expect(freshnessScore("2026-09-10T00:00:00.000Z", reference, 7)).toBe(1);
  });

  it("Given an unreadable date, When freshness is computed, Then it is zero", () => {
    expect(freshnessScore("not a date", reference, 7)).toBe(0);
  });

  it("Given listings with readable and unreadable dates, When the snapshot instant is read, Then it is the newest readable date", () => {
    expect(
      snapshotInstant([
        { postedAt: "2026-03-14T00:00:00.000Z" },
        { postedAt: "not a date" },
        { postedAt: "2026-09-09T00:00:00.000Z" },
      ]),
    ).toBe(reference);
  });

  it("Given no listings, When the snapshot instant is read, Then it is zero", () => {
    expect(snapshotInstant([])).toBe(0);
  });
});
