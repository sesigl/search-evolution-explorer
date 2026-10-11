import { describe, expect, it } from "vitest";
import { annotateQuery } from "./annotate.ts";
import { decidePolicy } from "./policy.ts";

describe("query annotation", () => {
  it("annotates behavior queries with high confidence", () => {
    expect(annotateQuery("area rug").productType).toBe("RUG");
    expect(annotateQuery("area rug").confidence).toBeGreaterThanOrEqual(0.9);
    expect(annotateQuery("table lamp").productType).toBe("LAMP");
  });
  it("parses accessory queries into the accessory family", () => {
    expect(annotateQuery("rug pad").productType).toBe("RUG_PAD");
    expect(annotateQuery("lamp shade").productType).toBe("LAMP_SHADE");
    expect(annotateQuery("curtain rod").productType).toBe("CURTAIN_HARDWARE");
    expect(annotateQuery("chair mat").productType).toBe("CHAIR_MAT");
    expect(annotateQuery("mattress topper").productType).toBe("MATTRESS_TOPPER");
  });
  it("reads a size as the model", () => {
    const parsed = annotateQuery("queen mattress");
    expect(parsed.productType).toBe("MATTRESS");
    expect(parsed.model).toBe("QUEEN");
  });
  it("reads a brand at lower parser confidence", () => {
    const parsed = annotateQuery("kohler faucet");
    expect(parsed.productType).toBe("FAUCET");
    expect(parsed.brand).toBe("KOHLER");
    expect(parsed.confidence).toBeLessThan(0.9);
  });
  it("abstains on ambiguous or unknown queries", () => {
    expect(annotateQuery("bicycle").productType).toBeNull();
    expect(annotateQuery("xqzt").source).toBe("none");
  });
});

describe("search policy", () => {
  it("filters only when query and ads are trustworthy", () => {
    expect(decidePolicy({ confidence: 0.97, adPrecision: 0.98, coverage: 0.9 })).toBe("FILTER");
    expect(decidePolicy({ confidence: 0.8, adPrecision: 0.98, coverage: 0.9 })).toBe("BOOST");
    expect(decidePolicy({ confidence: 0.4, adPrecision: 0.5, coverage: 0.5 })).toBe("FEATURE");
  });
});
