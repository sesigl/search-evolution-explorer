/** Pure geometry for the guided tour: where the spotlight sits and where its card goes. */
export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export type Side = "right" | "left" | "bottom" | "top";

export interface CardPosition {
  readonly top: number;
  readonly left: number;
  readonly side: Side;
}

export const SPOTLIGHT_PADDING = 8;
const GAP = 16;
const EDGE = 12;
/** Below this width the card is docked to the bottom edge instead of beside the target. */
export const DOCK_BELOW_WIDTH = 900;

/** The target rectangle grown by the padding, clamped to the viewport. */
export function spotlightRect(target: Rect, viewport: Viewport): Rect {
  const left = Math.max(0, target.left - SPOTLIGHT_PADDING);
  const top = Math.max(0, target.top - SPOTLIGHT_PADDING);
  const right = Math.min(viewport.width, target.left + target.width + SPOTLIGHT_PADDING);
  const bottom = Math.min(viewport.height, target.top + target.height + SPOTLIGHT_PADDING);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Picks the side with the most room for the card (preferring the requested one when it fits)
 * and returns a position that keeps the whole card inside the viewport.
 */
export function placeCard(
  spot: Rect,
  card: { width: number; height: number },
  viewport: Viewport,
  preferred: Side,
): CardPosition {
  const room: Record<Side, number> = {
    right: viewport.width - (spot.left + spot.width) - GAP - EDGE,
    left: spot.left - GAP - EDGE,
    bottom: viewport.height - (spot.top + spot.height) - GAP - EDGE,
    top: spot.top - GAP - EDGE,
  };
  const need = (side: Side) => (side === "left" || side === "right" ? card.width : card.height);
  const fits = (side: Side) => room[side] >= need(side);
  const order: Side[] = [preferred, "right", "bottom", "left", "top"];
  const side =
    order.find(fits) ??
    order.reduce((best, candidate) =>
      room[candidate] - need(candidate) > room[best] - need(best) ? candidate : best,
    );

  const centeredTop = spot.top + spot.height / 2 - card.height / 2;
  const centeredLeft = spot.left + spot.width / 2 - card.width / 2;
  const maxTop = viewport.height - card.height - EDGE;
  const maxLeft = viewport.width - card.width - EDGE;
  switch (side) {
    case "right":
      return {
        side,
        top: clamp(centeredTop, EDGE, maxTop),
        left: clamp(spot.left + spot.width + GAP, EDGE, maxLeft),
      };
    case "left":
      return {
        side,
        top: clamp(centeredTop, EDGE, maxTop),
        left: clamp(spot.left - GAP - card.width, EDGE, maxLeft),
      };
    case "bottom":
      return {
        side,
        top: clamp(spot.top + spot.height + GAP, EDGE, maxTop),
        left: clamp(centeredLeft, EDGE, maxLeft),
      };
    default:
      return {
        side,
        top: clamp(spot.top - GAP - card.height, EDGE, maxTop),
        left: clamp(centeredLeft, EDGE, maxLeft),
      };
  }
}

/** Card position for a step without a target: centred in the viewport. */
export function centerCard(
  card: { width: number; height: number },
  viewport: Viewport,
): CardPosition {
  return {
    side: "bottom",
    top: Math.max(EDGE, (viewport.height - card.height) / 2),
    left: Math.max(EDGE, (viewport.width - card.width) / 2),
  };
}
