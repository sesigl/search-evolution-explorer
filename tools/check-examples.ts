import process from "node:process";
import { levels } from "../src/domain/levels/level-registry.ts";

const missing = levels.filter(
  (level) => level.implemented && level.ordinal > 0 && level.guidedExamples.length === 0,
);

if (missing.length > 0) {
  process.stderr.write(
    `Implemented levels above 0 must ship a guided example: ${missing.map((level) => level.id).join(", ")}\n`,
  );
  process.exit(1);
}

process.stdout.write("Guided-example presence check passed.\n");
