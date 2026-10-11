import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { levels } from "../src/domain/levels/level-registry.ts";

const errors: string[] = [];
const ordinals = levels
  .map((level) => level.ordinal)
  .slice()
  .sort((a, b) => a - b);

for (const [index, ordinal] of ordinals.entries()) {
  if (ordinal !== index) {
    errors.push(`Ordinals must be contiguous from 0; expected ${index}, found ${ordinal}`);
  }
}

const ids = new Set<string>();
for (const level of levels) {
  if (ids.has(level.id)) {
    errors.push(`Duplicate level id: ${level.id}`);
  }
  ids.add(level.id);
  if (level.mechanism.trim() === "") {
    errors.push(`${level.id} is missing mechanism`);
  }
  if (level.tradeOff.trim() === "") {
    errors.push(`${level.id} is missing tradeOff`);
  }
  if (level.ordinal === 0) {
    if (level.fixesFailureMode !== null && level.fixesFailureMode.trim() === "") {
      errors.push(`${level.id} has an empty fixesFailureMode; use null at ordinal 0`);
    }
  } else if (level.fixesFailureMode === null || level.fixesFailureMode.trim() === "") {
    errors.push(`${level.id} is missing fixesFailureMode`);
  }
  if (level.changes !== "matching" && level.changes !== "scoring" && level.changes !== "both") {
    errors.push(`${level.id} is missing a matching-versus-scoring classification`);
  }
  const sourcePath = resolve(level.sourceSpecifier);
  if (!existsSync(sourcePath)) {
    errors.push(`${level.id} sourceSpecifier does not resolve: ${level.sourceSpecifier}`);
  }
  if (!level.implemented) {
    const previewLabel = `${level.label} ${level.capability}`.toLowerCase();
    if (!previewLabel.includes("preview")) {
      errors.push(`${level.id} is unimplemented and must carry a forward-preview label`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Content completeness passed for ${levels.length} level(s).\n`);
