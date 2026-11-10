import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { type HostingRoute, staticHostingRoutes } from "./hosting-policy.ts";

const hosted = process.env["VERCEL"] === "1";
const root = hosted ? ".vercel/output/static" : "dist/client";
const requiredFiles = [
  "index.html",
  "404.html",
  "search/index.html",
  "compare/index.html",
  "bias/index.html",
  "beyond/index.html",
  "scorecard/index.html",
  "scorecard/test/index.html",
  "api/scorecard.json",
  "api/two-tower.json",
  "api/method-not-allowed.json",
  "robots.txt",
];
for (const path of requiredFiles) {
  assert(existsSync(join(root, path)), `Missing static output: ${path}`);
}
const chapters = readdirSync(join(root, "level"));
assert(chapters.length > 0, "Missing static chapter pages");
for (const chapter of chapters) {
  assert(existsSync(join(root, "level", chapter, "index.html")), `Non-static chapter: ${chapter}`);
}
if (hosted) {
  const path = ".vercel/output/config.json";
  const config = JSON.parse(readFileSync(path, "utf8")) as { routes: HostingRoute[] };
  config.routes = staticHostingRoutes(config.routes);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}
process.stdout.write(
  `Static hosting verified: ${chapters.length} chapter pages; live compute limited to 3 protected POST APIs${hosted ? " at the CDN" : " (Vercel routing is checked on hosted builds)"}.\n`,
);
