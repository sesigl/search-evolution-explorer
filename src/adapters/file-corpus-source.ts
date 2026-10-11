import { readFile } from "node:fs/promises";
import type { CorpusSource } from "../domain/ports/corpus-source.ts";
import type { Category, CorpusItem } from "../domain/types/corpus.ts";

export function createFileCorpusSource(corpusPath: string): CorpusSource {
  return {
    async readItems(): Promise<readonly CorpusItem[]> {
      let raw: string;
      try {
        raw = await readFile(corpusPath, "utf8");
      } catch {
        throw new Error(`Corpus file not found: ${corpusPath}`);
      }
      return raw
        .split("\n")
        .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
        .filter((entry) => entry.line !== "")
        .map((entry) => parseItem(entry.line, entry.lineNumber, corpusPath));
    },
    async readCategories(): Promise<readonly Category[]> {
      const items = await this.readItems();
      const categories = new Map<string, Category>();
      for (const item of items) {
        if (!categories.has(item.categoryId)) {
          categories.set(item.categoryId, { id: item.categoryId, label: item.categoryId });
        }
      }
      return [...categories.values()];
    },
  };
}

function parseItem(line: string, lineNumber: number, corpusPath: string): CorpusItem {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Malformed NDJSON in ${corpusPath} on line ${lineNumber}`);
  }
  if (!isCorpusItem(parsed)) {
    throw new Error(`Malformed NDJSON in ${corpusPath} on line ${lineNumber}`);
  }
  return parsed;
}

function isCorpusItem(value: unknown): value is CorpusItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const priceCents = record["priceCents"];
  return (
    typeof record["id"] === "string" &&
    typeof record["title"] === "string" &&
    typeof record["description"] === "string" &&
    typeof record["categoryId"] === "string" &&
    typeof priceCents === "number" &&
    Number.isInteger(priceCents) &&
    priceCents >= 0 &&
    typeof record["location"] === "string" &&
    typeof record["postedAt"] === "string" &&
    typeof record["available"] === "boolean"
  );
}
