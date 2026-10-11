import { createHash } from "node:crypto";
import type { PrerequisiteState } from "../types/level.ts";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function resolvePrerequisiteState(
  artifactExists: boolean,
  recordedHash: string | null,
  currentHash: string,
): PrerequisiteState {
  if (!artifactExists) {
    return "missing";
  }
  if (recordedHash === null || recordedHash !== currentHash) {
    return "stale";
  }
  return "ready";
}
