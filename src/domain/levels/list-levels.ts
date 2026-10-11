import type { EvolutionLevel, PrerequisiteState } from "../types/level.ts";

export interface LevelListItem {
  readonly id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly capability: string;
  readonly mechanism: string;
  readonly tradeOff: string;
  readonly fixesFailureMode: string | null;
  readonly changes: EvolutionLevel["changes"];
  readonly implemented: boolean;
  readonly prerequisiteState: PrerequisiteState;
  readonly unavailableReason: string | null;
  readonly rebuildCommand: string | null;
}

export function listLevels(
  levels: readonly EvolutionLevel[],
  artifactState: (path: string) => PrerequisiteState,
): LevelListItem[] {
  return [...levels]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((level) => toListItem(level, artifactState));
}

function toListItem(
  level: EvolutionLevel,
  artifactState: (path: string) => PrerequisiteState,
): LevelListItem {
  const base = {
    id: level.id,
    ordinal: level.ordinal,
    label: level.label,
    capability: level.capability,
    mechanism: level.mechanism,
    tradeOff: level.tradeOff,
    fixesFailureMode: level.fixesFailureMode,
    changes: level.changes,
  };
  if (!level.implemented) {
    return {
      ...base,
      implemented: false,
      prerequisiteState: "missing",
      unavailableReason: "This level is a labelled forward preview and is not implemented yet.",
      rebuildCommand: null,
    };
  }
  const blocked = firstUnready(level, artifactState);
  if (blocked === null) {
    return {
      ...base,
      implemented: true,
      prerequisiteState: "ready",
      unavailableReason: null,
      rebuildCommand: null,
    };
  }
  return {
    ...base,
    implemented: true,
    prerequisiteState: blocked.state,
    unavailableReason: `This level is ${blocked.state}. Rebuild with ${blocked.buildCommand}.`,
    rebuildCommand: blocked.buildCommand,
  };
}

function firstUnready(
  level: EvolutionLevel,
  artifactState: (path: string) => PrerequisiteState,
): { state: PrerequisiteState; buildCommand: string } | null {
  for (const prerequisite of level.prerequisites) {
    const state = artifactState(prerequisite.artifactPath);
    if (state !== "ready") {
      return { state, buildCommand: prerequisite.buildCommand };
    }
  }
  return null;
}
