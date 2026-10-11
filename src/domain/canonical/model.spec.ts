import { describe, expect, it } from "vitest";
import type { CorpusItem } from "../types/corpus.ts";
import { brandOf, canonicalProductType, compatibleModel, modelOf } from "./model.ts";

function item(overrides: Partial<CorpusItem>): CorpusItem {
  return {
    id: "x",
    title: "",
    description: "",
    categoryId: "Furniture",
    priceCents: 100,
    location: "Berlin",
    postedAt: "2026-01-01T00:00:00.000Z",
    available: true,
    ...overrides,
  };
}

describe("canonical ad mapping", () => {
  it("separates a rug from a rug pad", () => {
    expect(canonicalProductType(item({ title: "Wool area rug" }))).toBe("RUG");
    expect(canonicalProductType(item({ title: "Non slip rug pad" }))).toBe("RUG_PAD");
  });
  it("separates a lamp from a lamp shade", () => {
    expect(canonicalProductType(item({ title: "Arwen table lamp" }))).toBe("LAMP");
    expect(canonicalProductType(item({ title: "Glass lamp shade" }))).toBe("LAMP_SHADE");
  });
  it("separates curtains from curtain hardware", () => {
    expect(canonicalProductType(item({ title: "Pearl living curtains" }))).toBe("CURTAIN");
    expect(canonicalProductType(item({ title: "Small curtain rod" }))).toBe("CURTAIN_HARDWARE");
  });
  it("separates a mattress from a mattress topper", () => {
    expect(canonicalProductType(item({ title: "Nectar queen mattress" }))).toBe("MATTRESS");
    expect(canonicalProductType(item({ title: "Foam mattress topper" }))).toBe("MATTRESS_TOPPER");
  });
  it("separates a chair from a chair mat", () => {
    expect(canonicalProductType(item({ title: "Tufted accent chair" }))).toBe("CHAIR");
    expect(canonicalProductType(item({ title: "Wood floor chair mat" }))).toBe("CHAIR_MAT");
  });
  it("maps a faucet and an unclear listing", () => {
    expect(canonicalProductType(item({ title: "Kohler kitchen faucet" }))).toBe("FAUCET");
    expect(canonicalProductType(item({ title: "4K monitor", description: "display" }))).toBe(
      "UNKNOWN",
    );
  });
  it("reads brands", () => {
    expect(brandOf(item({ title: "Kohler kitchen sink" }))).toBe("KOHLER");
    expect(brandOf(item({ title: "Moen matte black hooks" }))).toBe("MOEN");
    expect(brandOf(item({ title: "Blue sofa" }))).toBeNull();
  });
  it("reads sizes as models", () => {
    expect(modelOf(item({ title: "Queen bed frame" }))).toBe("QUEEN");
    expect(modelOf(item({ title: "California king mattress" }))).toBe("CALIFORNIA_KING");
    expect(compatibleModel(item({ title: "Twin mattress topper" }))).toBe("TWIN");
  });
});
