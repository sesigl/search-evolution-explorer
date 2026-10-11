import { UseCaseError } from "../search/errors.ts";

/**
 * Every domain module, as the text that ran. The code explorer reads from here, so a reader
 * can open any function a level calls. Spec files are not part of the lesson.
 */
const RAW_BY_GLOB_KEY = import.meta.glob<string>("../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const REGISTRY_DIR = "src/domain/code";

const SOURCE_BY_PATH: ReadonlyMap<string, string> = new Map(
  Object.entries(RAW_BY_GLOB_KEY)
    .map(([key, source]) => [resolvePath(REGISTRY_DIR, key), source] as const)
    .filter(([path]) => !path.endsWith(".spec.ts")),
);

export function listModulePaths(): ReadonlySet<string> {
  return new Set(SOURCE_BY_PATH.keys());
}

export function readModuleSource(path: string): string {
  const source = SOURCE_BY_PATH.get(path);
  if (source === undefined) {
    throw new UseCaseError("BAD_REQUEST", `No display source for module: ${path}`);
  }
  return source;
}

/** Resolves a relative specifier against a directory, POSIX style, without touching the disk. */
export function resolvePath(fromDir: string, relative: string): string {
  const parts: string[] = [];
  for (const part of `${fromDir}/${relative}`.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

export function dirnameOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}
