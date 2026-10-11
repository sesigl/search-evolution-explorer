import { existsSync, readFileSync } from "node:fs";
import { hashContent, resolvePrerequisiteState } from "../domain/artifacts/manifest.ts";
import type { PrerequisiteState } from "../domain/types/level.ts";

export function currentInputHash(path: string): string {
  if (!existsSync(path)) {
    return "";
  }
  return hashContent(readFileSync(path, "utf8"));
}

export function stateForPath(
  path: string,
  encoderReady: boolean,
  corpusHash: string,
  clicksHash: string,
): PrerequisiteState {
  if (path === "data/embeddings.bin") {
    if (!encoderReady) {
      return "missing";
    }
    return resolvePrerequisiteState(
      existsSync(path) && existsSync("data/embeddings.manifest.json"),
      recordedStringField("data/embeddings.manifest.json", "corpusHash"),
      corpusHash,
    );
  }
  if (path === "data/models/ranker-corrected.json") {
    return resolvePrerequisiteState(existsSync(path), recordedClickLogHash(path), clicksHash);
  }
  if (!existsSync(path)) {
    return "missing";
  }
  return "ready";
}

function recordedStringField(path: string, field: string): string | null {
  const parsed = readJsonRecord(path);
  if (parsed === null) {
    return null;
  }
  return stringField(parsed, field);
}

function recordedClickLogHash(path: string): string | null {
  const parsed = readJsonRecord(path);
  if (parsed === null) {
    return null;
  }
  const training = parsed["training"];
  if (!isRecord(training)) {
    return null;
  }
  return stringField(training, "clickLogHash");
}

function readJsonRecord(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed)) {
    return null;
  }
  return parsed;
}

function stringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (typeof value !== "string") {
    return null;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
