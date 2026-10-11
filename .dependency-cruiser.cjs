"use strict";
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Circular dependencies hide the direction of the ladder and the hexagon.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-no-adapters-pages-components",
      comment:
        "The domain must not import adapters, pages, or components. Dependencies point inward (Principle IV).",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(adapters|pages|components|layouts|actions)" },
    },
    {
      name: "domain-third-party-allow-list",
      comment:
        "The domain may import only the standard library and the stemmer package. Search internals are the lesson.",
      severity: "error",
      from: { path: "^src/domain", pathNot: "\\.spec\\.ts$" },
      to: {
        dependencyTypes: ["npm", "npm-dev"],
        pathNot: "node_modules/stemmer",
      },
    },
    {
      name: "only-di-imports-adapters",
      comment: "Only the composition root src/di.ts may import adapters (Principle IV).",
      severity: "error",
      from: { path: "^src/", pathNot: ["^src/di\\.ts$", "\\.spec\\.ts$"] },
      to: { path: "^src/adapters" },
    },
    {
      name: "level-0-imports-no-level",
      comment:
        "Level 0 is the baseline. It must not import any other level module (FR-003, FR-014).",
      severity: "error",
      from: { path: "^src/domain/levels/level-0-" },
      to: { path: "^src/domain/levels/level-[1-9]" },
    },
    {
      name: "level-1-imports-only-level-0",
      comment: "Level 1 may import only level 0 among level modules.",
      severity: "error",
      from: { path: "^src/domain/levels/level-1-" },
      to: { path: "^src/domain/levels/level-[2-9]" },
    },
    {
      name: "level-2-imports-only-level-1",
      comment: "Level 2 may import only level 1 among level modules.",
      severity: "error",
      from: { path: "^src/domain/levels/level-2-" },
      to: { path: "^src/domain/levels/level-[03-9]" },
    },
    {
      name: "level-3-imports-only-level-2",
      comment: "Level 3 may import only level 2 among level modules.",
      severity: "error",
      from: { path: "^src/domain/levels/level-3-" },
      to: { path: "^src/domain/levels/level-[014-9]" },
    },
    {
      name: "level-4-imports-only-level-3",
      comment: "Level 4 may import only level 3 among level modules.",
      severity: "error",
      from: { path: "^src/domain/levels/level-4-" },
      to: { path: "^src/domain/levels/level-[0-25-9]" },
    },
    {
      name: "level-6-imports-only-level-5",
      comment: "Level 6 extends the level 5 cascade.",
      severity: "error",
      from: { path: "^src/domain/levels/level-6-" },
      to: { path: "^src/domain/levels/level-[0-47-9]" },
    },
    {
      name: "level-5-imports-only-level-4",
      comment: "Level 5 may import only level 4 among level modules.",
      severity: "error",
      from: { path: "^src/domain/levels/level-5-" },
      to: { path: "^src/domain/levels/level-[0-36-9]" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".js", ".mjs", ".cjs"],
    },
  },
};
