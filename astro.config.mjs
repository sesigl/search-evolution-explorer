import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import node from "@astrojs/node";
import solidJs from "@astrojs/solid-js";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// `vercel build` sets VERCEL=1. Local builds keep the standalone Node server.
const deployToVercel = process.env.VERCEL === "1";

const ROLLDOWN_LINUX_BINDING = "./node_modules/@rolldown/binding-linux-x64-gnu";
const rolldownLinuxBindingFiles = existsSync(ROLLDOWN_LINUX_BINDING)
  ? [
      `${ROLLDOWN_LINUX_BINDING}/package.json`,
      `${ROLLDOWN_LINUX_BINDING}/rolldown-binding.linux-x64-gnu.node`,
    ]
  : [];

// Vercel functions run on Linux x64 without a GPU. The other ONNX runtime binaries and the
// CUDA and TensorRT providers would push the function over the Vercel size limit.
// The adapter matches excluded paths exactly, so this lists files instead of globs.
const GPU_PROVIDER = /providers_(cuda|tensorrt)/;

function unusedOnnxRuntimeFiles() {
  const binDir = "node_modules/onnxruntime-node/bin";
  if (!existsSync(binDir)) {
    return [];
  }
  return readdirSync(binDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() || entry.isSymbolicLink())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes("/linux/x64/") || GPU_PROVIDER.test(path))
    .map((path) => `./${path}`);
}

const vercelAdapter = vercel({
  // The server reads these artifacts from disk at request time.
  includeFiles: [
    "./data/corpus.ndjson",
    "./data/corpus.manifest.json",
    "./data/clicks.ndjson",
    "./data/clicks.manifest.json",
    "./data/judgments.ndjson",
    "./data/judgments.manifest.json",
    "./data/embeddings.manifest.json",
    "./data/logged-ranking.ndjson",
    "./data/levers/stopwords.json",
    "./data/levers/synonyms.json",
    "./data/levers/variants.json",
    "./data/models/bias-corrected.json",
    "./data/models/bias-naive.json",
    "./data/models/ranker-corrected.json",
    "./data/models/ranker-naive.json",
    "./data/models/two-tower/items.bin",
    "./data/models/two-tower/manifest.json",
    "./data/models/two-tower/model.json",
    "./data/precomputed/results.json",
    // The adapter code in the server bundle imports rolldown. Its native binding is loaded
    // by a computed name, so the file tracer misses it. It only exists on a Linux x64 install.
    ...rolldownLinuxBindingFiles,
  ],
  excludeFiles: unusedOnnxRuntimeFiles(),
  maxDuration: 60,
});

export default defineConfig({
  output: "server",
  adapter: deployToVercel ? vercelAdapter : node({ mode: "standalone" }),
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Stryker writes source copies under .stryker-tmp; watching them restarts the server.
        // The blog working folder is also outside src and must not restart the app.
        ignored: ["**/.stryker-tmp/**", "**/reports/**", "**/coverage/**", "**/content/**"],
      },
    },
  },
});
