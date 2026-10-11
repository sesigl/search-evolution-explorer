import { tokenize } from "../text/tokenize.ts";
import { brandFromText, type CanonicalProduct, productTypeFromText, sizeOf } from "./model.ts";

type AnnotationSource = "behavior" | "parser" | "none";

export interface QueryAnnotation {
  readonly productType: CanonicalProduct | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly compatibleWith: string | null;
  readonly confidence: number;
  readonly source: AnnotationSource;
}

const NONE: QueryAnnotation = {
  productType: null,
  brand: null,
  model: null,
  compatibleWith: null,
  confidence: 0,
  source: "none",
};

/**
 * High-confidence behavior table first: queries whose judged grades agree on one product
 * family. The parser below only fires when the table abstains.
 */
const BEHAVIOR: ReadonlyMap<string, QueryAnnotation> = new Map([
  [
    "area rug",
    {
      productType: "RUG",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
  [
    "rug pad",
    {
      productType: "RUG_PAD",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
  [
    "table lamp",
    {
      productType: "LAMP",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
  [
    "lamp shade",
    {
      productType: "LAMP_SHADE",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
  [
    "curtains",
    {
      productType: "CURTAIN",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.9,
      source: "behavior",
    },
  ],
  [
    "chair mat",
    {
      productType: "CHAIR_MAT",
      brand: null,
      model: null,
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
  [
    "queen mattress",
    {
      productType: "MATTRESS",
      brand: null,
      model: "QUEEN",
      compatibleWith: null,
      confidence: 0.95,
      source: "behavior",
    },
  ],
]);

/** Deterministic query parser over the canonical model. */
export function annotateQuery(rawText: string): QueryAnnotation {
  const normalized = tokenize(rawText).join(" ");
  const known = BEHAVIOR.get(normalized);
  if (known !== undefined) {
    return known;
  }
  return parseAliases(normalized);
}

function parseAliases(normalized: string): QueryAnnotation {
  const productType = productTypeFromText(normalized);
  const brand = brandFromText(normalized);
  const model = sizeOf(normalized);
  if (productType === "UNKNOWN" && brand === null && model === null) {
    return NONE;
  }
  return {
    productType: productType === "UNKNOWN" ? null : productType,
    brand,
    model,
    compatibleWith: null,
    confidence: productType === "UNKNOWN" ? 0.75 : 0.85,
    source: "parser",
  };
}
