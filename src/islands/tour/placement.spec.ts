import { describe, expect, it } from "vitest";
import { centerCard, placeCard, SPOTLIGHT_PADDING, spotlightRect } from "./placement.ts";

const viewport = { width: 1200, height: 800 };
const card = { width: 320, height: 200 };

describe("spotlightRect", () => {
  it("grows the target by the padding on every side", () => {
    expect(spotlightRect({ top: 100, left: 100, width: 200, height: 50 }, viewport)).toEqual({
      top: 100 - SPOTLIGHT_PADDING,
      left: 100 - SPOTLIGHT_PADDING,
      width: 200 + 2 * SPOTLIGHT_PADDING,
      height: 50 + 2 * SPOTLIGHT_PADDING,
    });
  });

  it("clamps to the viewport so the cut-out never leaves the screen", () => {
    const rect = spotlightRect({ top: -20, left: 1100, width: 300, height: 900 }, viewport);
    expect(rect.top).toBe(0);
    expect(rect.left + rect.width).toBe(viewport.width);
    expect(rect.top + rect.height).toBe(viewport.height);
  });
});

describe("placeCard", () => {
  it("uses the preferred side when the card fits there", () => {
    const spot = { top: 300, left: 100, width: 200, height: 100 };
    const position = placeCard(spot, card, viewport, "right");
    expect(position.side).toBe("right");
    expect(position.left).toBe(100 + 200 + 16);
    expect(position.top).toBe(300 + 50 - 100);
  });

  it("falls back to another side when the preferred one has no room", () => {
    const spot = { top: 300, left: 1000, width: 180, height: 100 };
    const position = placeCard(spot, card, viewport, "right");
    expect(position.side).not.toBe("right");
    expect(position.left + card.width).toBeLessThanOrEqual(viewport.width);
  });

  it("keeps the card inside the viewport when the target hugs an edge", () => {
    const spot = { top: 0, left: 0, width: 1200, height: 60 };
    const position = placeCard(spot, card, viewport, "top");
    expect(position.top).toBeGreaterThanOrEqual(0);
    expect(position.left).toBeGreaterThanOrEqual(0);
    expect(position.top + card.height).toBeLessThanOrEqual(viewport.height);
  });

  it("centres a card that has no target", () => {
    expect(centerCard(card, viewport)).toEqual({ side: "bottom", top: 300, left: 440 });
  });
});
