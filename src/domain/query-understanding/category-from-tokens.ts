import { stem } from "../text/stem.ts";

/**
 * Query terms that name each WANDS top-level category. Derived from the real
 * query distribution per category, then trimmed to unambiguous terms. A term
 * shared by several categories is fine: the vote ties and the predictor returns
 * null, which is what the ambiguous-query lesson needs.
 */
const CATEGORY_TERMS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "Furniture",
    [
      "table",
      "chair",
      "bed",
      "desk",
      "coffee",
      "cabinet",
      "dresser",
      "stool",
      "sofa",
      "couch",
      "bench",
      "ottoman",
      "recliner",
      "sectional",
      "nightstand",
      "bookcase",
      "headboard",
      "armoire",
      "wardrobe",
      "sideboard",
      "buffet",
      "futon",
      "daybed",
      "loveseat",
      "mattress",
    ],
  ],
  [
    "Décor & Pillows",
    [
      "wall",
      "mirror",
      "decor",
      "art",
      "curtain",
      "pillow",
      "throw",
      "sign",
      "clock",
      "frame",
      "vase",
      "wreath",
      "floral",
      "canvas",
    ],
  ],
  [
    "Home Improvement",
    [
      "tile",
      "faucet",
      "shower",
      "sink",
      "towel",
      "hook",
      "knob",
      "pull",
      "hardware",
      "door",
      "wallpaper",
      "molding",
      "toilet",
      "vanity",
      "backsplash",
      "grout",
      "mailbox",
    ],
  ],
  [
    "Outdoor",
    [
      "patio",
      "outdoor",
      "porch",
      "pergola",
      "awning",
      "umbrella",
      "deck",
      "garden",
      "lawn",
      "fence",
      "sandbox",
      "greenhouse",
      "sauna",
    ],
  ],
  ["Lighting", ["light", "lamp", "sconce", "chandelier", "bulb", "pendant", "lantern"]],
  [
    "Bed & Bath",
    ["mattress", "duvet", "comforter", "sheet", "pillowcase", "topper", "bedding", "quilt", "tub"],
  ],
  [
    "Storage & Organization",
    ["rack", "closet", "shelf", "basket", "bin", "organizer", "pantry", "hamper", "storage"],
  ],
  ["Rugs", ["rug", "carpet", "mat", "shag"]],
  [
    "Kitchen & Tabletop",
    [
      "kitchen",
      "cookware",
      "plate",
      "bowl",
      "glassware",
      "utensil",
      "canister",
      "bakeware",
      "tabletop",
      "dish",
      "skillet",
    ],
  ],
  ["Baby & Kids", ["kids", "kid", "crib", "nursery", "toddler", "bunk", "playhouse", "baby"]],
  [
    "Appliances",
    ["appliance", "washer", "dryer", "refrigerator", "dishwasher", "microwave", "range", "hood"],
  ],
]);

export function categoryFromTokens(tokens: readonly string[]): string | null {
  let bestId: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [categoryId, terms] of CATEGORY_TERMS) {
    let count = 0;
    for (const token of tokens) {
      if (terms.some((term) => sameStem(term, token))) {
        count += 1;
      }
    }
    if (count > bestCount) {
      bestId = categoryId;
      bestCount = count;
      tied = false;
    } else if (count === bestCount && count > 0) {
      tied = true;
    }
  }
  return tied ? null : bestId;
}

function sameStem(term: string, token: string): boolean {
  return term === token || stem(term) === stem(token);
}
