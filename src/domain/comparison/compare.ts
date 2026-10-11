import type { RankedResult } from "../types/ranking.ts";

interface RankMovement {
  readonly itemId: string;
  readonly fromPosition: number;
  readonly toPosition: number;
  readonly attributedSignal: string;
}

interface MembershipChange {
  readonly itemId: string;
  readonly reason: string;
}

export type MembershipKind = "matching" | "scoring";

export interface LevelComparison {
  readonly entered: readonly MembershipChange[];
  readonly exited: readonly MembershipChange[];
  readonly moved: readonly RankMovement[];
  readonly identical: boolean;
}

export function compareRankings(
  left: readonly RankedResult[],
  right: readonly RankedResult[],
  membershipKind: MembershipKind,
): LevelComparison {
  const leftById = byId(left);
  const rightById = byId(right);
  const entered: MembershipChange[] = [];
  const exited: MembershipChange[] = [];
  const moved: RankMovement[] = [];
  for (const result of right) {
    const previous = leftById.get(result.item.id);
    if (previous === undefined) {
      entered.push({
        itemId: result.item.id,
        reason: membershipReason(membershipKind, "entered"),
      });
    } else if (previous.position !== result.position) {
      moved.push({
        itemId: result.item.id,
        fromPosition: previous.position,
        toPosition: result.position,
        attributedSignal: attributedSignal(previous, result),
      });
    }
  }
  for (const result of left) {
    if (!rightById.has(result.item.id)) {
      exited.push({
        itemId: result.item.id,
        reason: membershipReason(membershipKind, "exited"),
      });
    }
  }
  return {
    entered,
    exited,
    moved,
    identical: entered.length === 0 && exited.length === 0 && moved.length === 0,
  };
}

function membershipReason(kind: MembershipKind, side: "entered" | "exited"): string {
  if (kind === "scoring") {
    return side === "entered"
      ? "scoring: the right level ranked this listing into the displayed list"
      : "scoring: the right level ranked this listing outside the displayed list";
  }
  return side === "entered"
    ? "matching and ranking: this listing entered the displayed results; inspect its retrieval signals"
    : "matching and ranking: this listing left the displayed results, but may remain a candidate";
}

function byId(results: readonly RankedResult[]): Map<string, RankedResult> {
  const map = new Map<string, RankedResult>();
  for (const result of results) {
    map.set(result.item.id, result);
  }
  return map;
}

function attributedSignal(left: RankedResult, right: RankedResult): string {
  let bestName = "score";
  let bestDelta = 0;
  const leftValues = valuesByName(left);
  const rightValues = valuesByName(right);
  // A joint model replaces the old score; diagnostic ranks are not additive score features.
  if (leftValues.has("crossEncoder") || rightValues.has("crossEncoder")) {
    if (leftValues.get("crossEncoder") === rightValues.get("crossEncoder")) {
      if (left.score !== right.score) {
        return "twoTowerSimilarity";
      }
      return "candidateCompetition";
    }
    return "crossEncoder";
  }
  const names = new Set([...leftValues.keys(), ...rightValues.keys()]);
  for (const name of names) {
    const delta = Math.abs((rightValues.get(name) ?? 0) - (leftValues.get(name) ?? 0));
    if (delta > bestDelta) {
      bestDelta = delta;
      bestName = name;
    }
  }
  return bestName;
}

function valuesByName(result: RankedResult): Map<string, number> {
  const values = new Map<string, number>();
  for (const signal of result.signals) {
    values.set(signal.name, signal.value);
  }
  return values;
}
