import type { CorpusItem } from "../types/corpus.ts";
import type { QueryAnnotation } from "./annotate.ts";
import { brandOf, canonicalProductType, compatibleModel, modelOf } from "./model.ts";

export interface AttributeMatch {
  readonly productTypeMatch: number;
  readonly attributeMatch: number;
}

/**
 * Whether a listing survives a FILTER decision. UNKNOWN listings always
 * survive; known mismatches on any annotated field remove the listing.
 */
export function keepCandidate(annotation: QueryAnnotation, entry: CorpusItem): boolean {
  if (annotation.productType === null) {
    return true;
  }
  const canonical = canonicalProductType(entry);
  if (canonical === "UNKNOWN") {
    return true;
  }
  if (canonical !== annotation.productType) {
    return false;
  }
  return brandAgrees(annotation.brand, entry) && modelAgrees(annotation, entry);
}

/**
 * Scoring support: 1 when the canonical type agrees, plus 1 when every
 * annotated brand, model and compatibility detail agrees too.
 */
export function attributeMatch(annotation: QueryAnnotation, entry: CorpusItem): AttributeMatch {
  if (annotation.productType === null) {
    return { productTypeMatch: 0, attributeMatch: 0 };
  }
  if (canonicalProductType(entry) !== annotation.productType) {
    return { productTypeMatch: 0, attributeMatch: 0 };
  }
  const agreed = brandAgrees(annotation.brand, entry) && modelAgrees(annotation, entry) ? 1 : 0;
  return { productTypeMatch: 1, attributeMatch: agreed };
}

function brandAgrees(brand: string | null, entry: CorpusItem): boolean {
  if (brand === null) {
    return true;
  }
  const known = brandOf(entry);
  return known === null || known === brand;
}

function modelAgrees(annotation: QueryAnnotation, entry: CorpusItem): boolean {
  if (annotation.model !== null) {
    const known = modelOf(entry);
    if (known !== null && known !== annotation.model) {
      return false;
    }
  }
  if (annotation.compatibleWith !== null) {
    const known = compatibleModel(entry);
    if (known !== null && known !== annotation.compatibleWith) {
      return false;
    }
  }
  return true;
}
