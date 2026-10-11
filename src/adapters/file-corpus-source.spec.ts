import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileCorpusSource } from "./file-corpus-source.ts";

const secondLine = /line 2/i;
const firstLine = /line 1/i;

const validItem = {
  id: "item-1",
  title: "Golf clubs",
  description: "A set of irons",
  categoryId: "sports",
  priceCents: 12_000,
  location: "Berlin",
  postedAt: "2026-01-15T00:00:00.000Z",
  available: true,
};

describe("file corpus source", () => {
  it("Given a missing file, When the corpus is read, Then the error names the path", async () => {
    const path = join(tmpdir(), "missing-corpus.ndjson");
    const source = createFileCorpusSource(path);
    await expect(source.readItems()).rejects.toThrow(path);
  });

  it("Given a malformed NDJSON line, When the corpus is read, Then that line is rejected", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const path = join(dir, "corpus.ndjson");
    await writeFile(path, `${JSON.stringify(validItem)}\n{not-json\n`);
    const source = createFileCorpusSource(path);
    await expect(source.readItems()).rejects.toThrow(secondLine);
  });

  it("Given a JSON object that is not a corpus item, When the corpus is read, Then that line is rejected", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const path = join(dir, "corpus.ndjson");
    await writeFile(path, `${JSON.stringify({ id: 1 })}\n`);
    const source = createFileCorpusSource(path);
    await expect(source.readItems()).rejects.toThrow(firstLine);
  });

  it("Given a null JSON value, When the corpus is read, Then that line is rejected", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const path = join(dir, "corpus.ndjson");
    await writeFile(path, "null\n");
    const source = createFileCorpusSource(path);
    await expect(source.readItems()).rejects.toThrow(firstLine);
  });

  it("Given valid items, When categories are read, Then each category id appears once", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const path = join(dir, "corpus.ndjson");
    const second = { ...validItem, id: "item-2", categoryId: "electronics" };
    await writeFile(path, `${JSON.stringify(validItem)}\n${JSON.stringify(second)}\n`);
    const source = createFileCorpusSource(path);
    const categories = await source.readCategories();
    expect(categories.map((category) => category.id).sort()).toEqual(["electronics", "sports"]);
  });

  it("Given valid items, When the corpus is read, Then each item is returned in file order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const path = join(dir, "corpus.ndjson");
    const second = { ...validItem, id: "item-2", title: "Golf course photo" };
    await writeFile(path, `${JSON.stringify(validItem)}\n${JSON.stringify(second)}\n`);
    const source = createFileCorpusSource(path);
    const items = await source.readItems();
    expect(items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
  });
});
