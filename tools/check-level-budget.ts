import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const LEVEL_LINE_BUDGET = 150;
const LEVEL_FILE = /^level-\d+.*\.ts$/;
const levelsDir = resolve("src/domain/levels");

if (!existsSync(levelsDir)) {
  process.stdout.write("No level modules yet; line-budget check is vacuously true.\n");
  process.exit(0);
}

const levelFiles = readdirSync(levelsDir).filter(
  (name) => LEVEL_FILE.test(name) && !name.endsWith(".spec.ts"),
);
const offenders: string[] = [];
for (const name of levelFiles) {
  const path = join(levelsDir, name);
  const lineCount = readFileSync(path, "utf8").split("\n").length;
  if (lineCount > LEVEL_LINE_BUDGET) {
    offenders.push(`${name}: ${lineCount} lines`);
  }
}

if (offenders.length > 0) {
  process.stderr.write(
    `Level modules exceed ${LEVEL_LINE_BUDGET} lines:\n${offenders.join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write("Level line-budget check passed.\n");
