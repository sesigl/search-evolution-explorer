import { itemText } from "../text/item-text.ts";
import type { CorpusItem } from "../types/corpus.ts";

export type CanonicalProduct =
  | "RUG"
  | "RUG_PAD"
  | "LAMP"
  | "LAMP_SHADE"
  | "CURTAIN"
  | "CURTAIN_HARDWARE"
  | "MATTRESS"
  | "MATTRESS_TOPPER"
  | "CHAIR"
  | "CHAIR_MAT"
  | "FAUCET"
  | "UNKNOWN";

const RUG_PAD_WORDS = ["rug pad", "carpet pad", "rug grip", "carpet grip"];
const RUG_WORDS = ["rug", "carpet", "shag"];
const LAMP_SHADE_WORDS = ["lamp shade", "light shade"];
const LAMP_WORDS = ["lamp"];
const CURTAIN_HARDWARE_WORDS = [
  "curtain rod",
  "curtain hook",
  "curtain hardware",
  "curtain bracket",
  "curtain ring",
  "tie back",
  "tieback",
];
const CURTAIN_WORDS = ["curtain", "drape"];
const MATTRESS_TOPPER_WORDS = [
  "mattress topper",
  "mattress pad",
  "mattress protector",
  "mattress cover",
];
const MATTRESS_WORDS = ["mattress"];
const CHAIR_MAT_WORDS = ["chair mat", "chairmat"];
const CHAIR_WORDS = ["chair"];
const FAUCET_WORDS = ["faucet"];

const CALIFORNIA_KING = /\b(california king|cal king)\b/;
const TWIN_XL = /\btwin( xl| extra long)\b/;
const QUEEN = /\bqueen\b/;
const KING = /\bking\b/;
const FULL = /\bfull\b/;
const TWIN = /\btwin\b/;

const BRANDS: readonly (readonly [string, readonly string[]])[] = [
  ["KOHLER", ["kohler"]],
  ["MOEN", ["moen"]],
  ["KRAUS", ["kraus"]],
  ["SERTA", ["serta"]],
  ["NESPRESSO", ["nespresso"]],
];

function lowered(item: CorpusItem): string {
  return itemText(item).toLowerCase();
}

function hasAny(haystack: string, words: readonly string[]): boolean {
  return words.some((word) => haystack.includes(word));
}

/**
 * Deterministic ad canonicalization: the title text maps into one shared product family.
 * Accessory families are recognised before their base family, so a rug pad is a pad and not
 * a rug. Fully unclear listings are UNKNOWN and are never hard-filtered.
 */
export function canonicalProductType(item: CorpusItem): CanonicalProduct {
  return productTypeFromText(lowered(item));
}

/** The same family scan, usable on a raw query string. */
export function productTypeFromText(text: string): CanonicalProduct {
  return (
    rugType(text) ??
    lampType(text) ??
    curtainType(text) ??
    mattressType(text) ??
    chairType(text) ??
    faucetType(text) ??
    "UNKNOWN"
  );
}

/** Known manufacturer brand named by a listing, or null when unclear. */
export function brandOf(item: CorpusItem): string | null {
  return brandFromText(lowered(item));
}

export function brandFromText(text: string): string | null {
  for (const [name, words] of BRANDS) {
    if (hasAny(text, words)) {
      return name;
    }
  }
  return null;
}

/** A size named by a listing, e.g. a queen mattress. Reused for accessories. */
export function modelOf(item: CorpusItem): string | null {
  return sizeOf(lowered(item));
}

export function compatibleModel(item: CorpusItem): string | null {
  return sizeOf(lowered(item));
}

export function sizeOf(text: string): string | null {
  if (CALIFORNIA_KING.test(text)) {
    return "CALIFORNIA_KING";
  }
  if (TWIN_XL.test(text)) {
    return "TWIN_XL";
  }
  if (QUEEN.test(text)) {
    return "QUEEN";
  }
  if (KING.test(text)) {
    return "KING";
  }
  if (FULL.test(text)) {
    return "FULL";
  }
  if (TWIN.test(text)) {
    return "TWIN";
  }
  return null;
}

function rugType(text: string): CanonicalProduct | null {
  if (hasAny(text, RUG_PAD_WORDS)) {
    return "RUG_PAD";
  }
  return hasAny(text, RUG_WORDS) ? "RUG" : null;
}

function lampType(text: string): CanonicalProduct | null {
  if (hasAny(text, LAMP_SHADE_WORDS)) {
    return "LAMP_SHADE";
  }
  return hasAny(text, LAMP_WORDS) ? "LAMP" : null;
}

function curtainType(text: string): CanonicalProduct | null {
  if (hasAny(text, CURTAIN_HARDWARE_WORDS)) {
    return "CURTAIN_HARDWARE";
  }
  return hasAny(text, CURTAIN_WORDS) ? "CURTAIN" : null;
}

function mattressType(text: string): CanonicalProduct | null {
  if (hasAny(text, MATTRESS_TOPPER_WORDS)) {
    return "MATTRESS_TOPPER";
  }
  return hasAny(text, MATTRESS_WORDS) ? "MATTRESS" : null;
}

function chairType(text: string): CanonicalProduct | null {
  if (hasAny(text, CHAIR_MAT_WORDS)) {
    return "CHAIR_MAT";
  }
  return hasAny(text, CHAIR_WORDS) ? "CHAIR" : null;
}

function faucetType(text: string): CanonicalProduct | null {
  return hasAny(text, FAUCET_WORDS) ? "FAUCET" : null;
}
