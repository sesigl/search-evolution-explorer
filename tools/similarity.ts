import { spawnSync } from "node:child_process";
import process from "node:process";

const result = spawnSync("similarity-ts", ["src"], { encoding: "utf8" });
if (result.error) {
  process.stdout.write("similarity-ts is not available; skipping advisory AST clone check.\n");
  process.exit(0);
}
if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exit(result.status ?? 0);
