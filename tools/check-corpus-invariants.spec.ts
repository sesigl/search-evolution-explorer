import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../src/domain/types/corpus.ts";
import { checkCorpusInvariants } from "./check-corpus-invariants.ts";

const UNIQUE = /unique/i;
const TITLE = /title/i;
const CATEGORIES = /categories/i;
const SYNONYM = /synonym/i;
const TWO_CATEGORIES = /two categories/i;

function daysAgo(days: number): string {
  const date = new Date(Date.UTC(2026, 8, 9));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function listing(partial: Partial<CorpusItem> & { id: string; title: string }): CorpusItem {
  return {
    description: "d",
    categoryId: "Furniture",
    priceCents: 1000,
    location: "Berlin",
    postedAt: daysAgo(10),
    available: true,
    ...partial,
  };
}

function validCorpus(): CorpusItem[] {
  return [
    listing({
      id: "sofa",
      title: "Blue wood sofa",
      categoryId: "Furniture",
      priceCents: 100,
      postedAt: daysAgo(5),
    }),
    listing({
      id: "couch",
      title: "Grey couch",
      categoryId: "Furniture",
      priceCents: 2000,
      postedAt: daysAgo(120),
    }),
    listing({ id: "rug", title: "Wool rug", categoryId: "Rugs", postedAt: daysAgo(45) }),
    listing({ id: "lamp", title: "Table lamp", categoryId: "Lighting" }),
    listing({ id: "tile", title: "Stone wood tile", categoryId: "Home Improvement" }),
    listing({ id: "bed", title: "Oak bed", categoryId: "Bed & Bath" }),
    listing({ id: "rack", title: "Shoe rack", categoryId: "Storage & Organization" }),
    listing({ id: "mirror", title: "Round mirror", categoryId: "Décor & Pillows" }),
    listing({ id: "pan", title: "Frying pan", categoryId: "Kitchen & Tabletop" }),
    listing({ id: "chair", title: "Oak chair", categoryId: "Furniture" }),
  ];
}

describe("corpus invariants", () => {
  it("Given a corpus with the teaching properties, When invariants are checked, Then it passes", () => {
    expect(() => checkCorpusInvariants(validCorpus())).not.toThrow();
  });

  it("Given duplicate ids, When invariants are checked, Then uniqueness fails", () => {
    const items = validCorpus();
    const first = items[0];
    if (first === undefined) {
      throw new Error("expected a first item");
    }
    items.push({ ...first, title: "Copy" });
    expect(() => checkCorpusInvariants(items)).toThrow(UNIQUE);
  });

  it("Given an empty title, When invariants are checked, Then the title fails", () => {
    const items = validCorpus().map((item) =>
      item.id === "lamp" ? { ...item, title: "  " } : item,
    );
    expect(() => checkCorpusInvariants(items)).toThrow(TITLE);
  });

  it("Given fewer than eight categories, When invariants are checked, Then coverage fails", () => {
    const items = validCorpus().map((item) => ({ ...item, categoryId: "Furniture" }));
    expect(() => checkCorpusInvariants(items)).toThrow(CATEGORIES);
  });

  it("Given no couch listing, When invariants are checked, Then the synonym pair fails", () => {
    const items = validCorpus().filter((item) => item.id !== "couch");
    expect(() => checkCorpusInvariants(items)).toThrow(SYNONYM);
  });

  it("Given no term that spans two categories, When invariants are checked, Then ambiguity fails", () => {
    const items = validCorpus().map((item) => ({ ...item, title: `${item.id} ${item.id}zz` }));
    expect(() => checkCorpusInvariants(items)).toThrow(TWO_CATEGORIES);
  });
});
