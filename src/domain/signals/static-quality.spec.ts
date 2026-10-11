import { describe, expect, it } from "vitest";
import type { Clock } from "../ports/clock.ts";
import type { CorpusItem } from "../types/corpus.ts";
import { computeStaticQuality } from "./static-quality.ts";

const clock: Clock = {
  now() {
    return new Date("2026-09-09T00:00:00.000Z");
  },
};

function item(
  id: string,
  title: string,
  postedAt: string,
  priceCents: number,
  categoryId = "electronics",
): CorpusItem {
  return {
    id,
    title,
    description: "",
    categoryId,
    priceCents,
    location: "Berlin",
    postedAt,
    available: true,
  };
}

describe("static quality", () => {
  it("Given two posting dates, When static quality is computed, Then the newer listing has higher recency", () => {
    const scores = computeStaticQuality(
      [
        item("new", "USB cable extra long", "2026-09-08T00:00:00.000Z", 500),
        item("old", "USB cable extra long", "2026-01-01T00:00:00.000Z", 500),
      ],
      clock,
    );
    expect(scores.get("new")?.recency ?? 0).toBeGreaterThan(scores.get("old")?.recency ?? 0);
  });

  it("Given titles of different length, When static quality is computed, Then the longer title has higher title quality", () => {
    const scores = computeStaticQuality(
      [
        item("short", "USB", "2026-09-08T00:00:00.000Z", 500),
        item("long", "USB cable extra long", "2026-09-08T00:00:00.000Z", 500),
      ],
      clock,
    );
    expect(scores.get("long")?.titleQuality ?? 0).toBeGreaterThan(
      scores.get("short")?.titleQuality ?? 0,
    );
  });

  it("Given an invalid posting date, When static quality is computed, Then recency is zero", () => {
    const scores = computeStaticQuality(
      [item("bad", "USB cable extra long", "not-a-date", 500)],
      clock,
    );
    expect(scores.get("bad")?.recency).toBe(0);
  });

  it("Given prices in one category, When static quality is computed, Then the dearer item has a higher price percentile", () => {
    const scores = computeStaticQuality(
      [
        item("cheap", "USB cable extra long", "2026-09-08T00:00:00.000Z", 500),
        item("dear", "USB cable extra long", "2026-09-08T00:00:00.000Z", 5000),
      ],
      clock,
    );
    expect(scores.get("dear")?.pricePercentile ?? 0).toBeGreaterThan(
      scores.get("cheap")?.pricePercentile ?? 0,
    );
  });
});
