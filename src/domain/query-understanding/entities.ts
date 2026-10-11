import { itemText } from "../text/item-text.ts";
import { tokenize } from "../text/tokenize.ts";
import type { CorpusItem } from "../types/corpus.ts";
import type { QueryUnderstanding, SpellingCorrection } from "../types/query.ts";

type ConceptType = "color" | "material" | "brand" | "productType";

export interface EntityConcept {
  readonly type: ConceptType;
  readonly value: string;
  readonly sourceTokens: readonly string[];
  /** Words that name this concept in plain text; multi-word aliases use spaces. */
  readonly textAliases: readonly string[];
}

export interface ConceptSupport {
  readonly structural: number;
  readonly lexical: number;
}

export interface ConceptDetail {
  readonly structural: readonly string[];
  readonly lexical: readonly string[];
}

interface ConceptDef {
  readonly type: ConceptType;
  readonly value: string;
  readonly aliases: readonly string[];
}

/**
 * The readable ontology over the WANDS catalog: colours, materials, brands and
 * product types. Query and item use the same tables, so "turquoise pillows" and a
 * listing whose features say `color : turquoise` meet at colour TURQUOISE even when
 * the title never writes the word.
 */
const CONCEPTS: readonly ConceptDef[] = [
  { type: "color", value: "BLACK", aliases: ["black"] },
  { type: "color", value: "WHITE", aliases: ["white"] },
  { type: "color", value: "GRAY", aliases: ["gray", "grey"] },
  { type: "color", value: "BROWN", aliases: ["brown"] },
  { type: "color", value: "BLUE", aliases: ["blue"] },
  { type: "color", value: "BEIGE", aliases: ["beige"] },
  { type: "color", value: "GREEN", aliases: ["green"] },
  { type: "color", value: "SILVER", aliases: ["silver"] },
  { type: "color", value: "RED", aliases: ["red"] },
  { type: "color", value: "PINK", aliases: ["pink"] },
  { type: "color", value: "YELLOW", aliases: ["yellow"] },
  { type: "color", value: "GOLD", aliases: ["gold"] },
  { type: "color", value: "NAVY", aliases: ["navy"] },
  { type: "color", value: "ORANGE", aliases: ["orange"] },
  { type: "color", value: "IVORY", aliases: ["ivory"] },
  { type: "color", value: "PURPLE", aliases: ["purple"] },
  { type: "color", value: "TURQUOISE", aliases: ["turquoise"] },
  { type: "color", value: "TEAL", aliases: ["teal"] },
  { type: "color", value: "WALNUT", aliases: ["walnut"] },
  { type: "color", value: "ESPRESSO", aliases: ["espresso"] },
  { type: "color", value: "CHARCOAL", aliases: ["charcoal"] },
  { type: "material", value: "LEATHER", aliases: ["leather"] },
  { type: "material", value: "WOOD", aliases: ["wood", "wooden", "timber"] },
  { type: "material", value: "METAL", aliases: ["metal"] },
  { type: "material", value: "GLASS", aliases: ["glass"] },
  { type: "material", value: "FABRIC", aliases: ["fabric", "upholstered"] },
  { type: "material", value: "VELVET", aliases: ["velvet"] },
  { type: "material", value: "COTTON", aliases: ["cotton"] },
  { type: "material", value: "STEEL", aliases: ["steel"] },
  { type: "material", value: "CERAMIC", aliases: ["ceramic"] },
  { type: "material", value: "MARBLE", aliases: ["marble"] },
  { type: "material", value: "RATTAN", aliases: ["rattan", "wicker"] },
  { type: "material", value: "IRON", aliases: ["iron"] },
  { type: "material", value: "PLASTIC", aliases: ["plastic"] },
  { type: "material", value: "POLYESTER", aliases: ["polyester"] },
  { type: "brand", value: "KOHLER", aliases: ["kohler"] },
  { type: "brand", value: "MOEN", aliases: ["moen"] },
  { type: "brand", value: "KRAUS", aliases: ["kraus"] },
  { type: "brand", value: "SERTA", aliases: ["serta"] },
  { type: "brand", value: "NESPRESSO", aliases: ["nespresso"] },
  { type: "brand", value: "BREVILLE", aliases: ["breville"] },
  { type: "productType", value: "CHAIR", aliases: ["chair", "chairs"] },
  { type: "productType", value: "TABLE", aliases: ["table", "tables"] },
  { type: "productType", value: "SOFA", aliases: ["sofa", "couch", "loveseat", "settee"] },
  { type: "productType", value: "BED", aliases: ["bed", "beds"] },
  { type: "productType", value: "DRESSER", aliases: ["dresser"] },
  { type: "productType", value: "DESK", aliases: ["desk"] },
  { type: "productType", value: "RUG", aliases: ["rug", "carpet"] },
  { type: "productType", value: "LAMP", aliases: ["lamp"] },
  { type: "productType", value: "MIRROR", aliases: ["mirror"] },
  { type: "productType", value: "VANITY", aliases: ["vanity"] },
  { type: "productType", value: "SINK", aliases: ["sink"] },
  { type: "productType", value: "FAUCET", aliases: ["faucet"] },
  { type: "productType", value: "CURTAIN", aliases: ["curtain", "drapes"] },
  { type: "productType", value: "PILLOW", aliases: ["pillow", "pillows", "cushion", "cushions"] },
  { type: "productType", value: "CABINET", aliases: ["cabinet"] },
  { type: "productType", value: "BOOKCASE", aliases: ["bookcase", "bookshelf"] },
  { type: "productType", value: "STOOL", aliases: ["stool"] },
  { type: "productType", value: "BENCH", aliases: ["bench"] },
  { type: "productType", value: "OTTOMAN", aliases: ["ottoman", "pouf"] },
  { type: "productType", value: "MATTRESS", aliases: ["mattress"] },
  { type: "productType", value: "TILE", aliases: ["tile"] },
  { type: "productType", value: "FAN", aliases: ["fan"] },
  { type: "productType", value: "SCONCE", aliases: ["sconce"] },
  { type: "productType", value: "CHANDELIER", aliases: ["chandelier"] },
  {
    type: "productType",
    value: "STORAGE",
    aliases: ["storage", "organizer", "wardrobe", "armoire"],
  },
];

const BY_TOKEN: ReadonlyMap<string, readonly ConceptDef[]> = buildTokenIndex();
const PHRASES: readonly { tokens: readonly string[]; def: ConceptDef }[] = buildPhraseIndex();

function buildTokenIndex(): ReadonlyMap<string, readonly ConceptDef[]> {
  const index = new Map<string, ConceptDef[]>();
  for (const def of CONCEPTS) {
    for (const alias of def.aliases) {
      if (!alias.includes(" ")) {
        const known = index.get(alias) ?? [];
        known.push(def);
        index.set(alias, known);
      }
    }
  }
  return index;
}

function buildPhraseIndex(): readonly { tokens: readonly string[]; def: ConceptDef }[] {
  const phrases: { tokens: readonly string[]; def: ConceptDef }[] = [];
  for (const def of CONCEPTS) {
    for (const alias of def.aliases) {
      if (alias.includes(" ")) {
        phrases.push({ tokens: alias.split(" "), def });
      }
    }
  }
  return phrases;
}

/** Concepts named by the query words, in order. AND semantics: every one must hold. */
export function extractQueryConcepts(understanding: QueryUnderstanding): EntityConcept[] {
  return conceptsFromTokens(understanding.tokens);
}

/**
 * Apply spelling fixes to raw tokens before tagging, so "ligth bulb" tags the same
 * concepts as "light bulb". Compound splits ("iphonecase" to "iphone case") rejoin
 * the token stream.
 */
export function retokenize(
  tokens: readonly string[],
  fixes: readonly SpellingCorrection[],
): readonly string[] {
  if (fixes.length === 0) {
    return tokens;
  }
  const rewrite = new Map(fixes.map((fix) => [fix.from, fix.to]));
  return tokens.flatMap((token) => rewrite.get(token)?.split(" ") ?? [token]);
}

/** Concepts named by the listing text. No corpus migration. */
export function extractItemConcepts(item: CorpusItem): EntityConcept[] {
  return conceptsFromTokens(tokenize(itemText(item)));
}

function conceptsFromTokens(tokens: readonly string[]): EntityConcept[] {
  const concepts: EntityConcept[] = [];
  let index = 0;
  while (index < tokens.length) {
    const step = conceptsAt(tokens, index);
    concepts.push(...step.concepts);
    index += step.length;
  }
  return dedupe(concepts);
}

function conceptsAt(
  tokens: readonly string[],
  index: number,
): { concepts: EntityConcept[]; length: number } {
  const pair = phraseAt(tokens, index);
  if (pair !== null) {
    const parts = pair.tokens.flatMap((part) => singleConcepts(part));
    return {
      concepts: [toConcept(pair.def, [...pair.tokens]), ...parts],
      length: pair.tokens.length,
    };
  }
  const token = tokens[index] ?? "";
  return { concepts: singleConcepts(token), length: 1 };
}

function singleConcepts(token: string): EntityConcept[] {
  return (BY_TOKEN.get(token) ?? []).map((def) => toConcept(def, [token]));
}

function phraseAt(
  tokens: readonly string[],
  index: number,
): { tokens: readonly string[]; def: ConceptDef } | null {
  for (const phrase of PHRASES) {
    if (phrase.tokens.every((part, offset) => tokens[index + offset] === part)) {
      return phrase;
    }
  }
  return null;
}

function toConcept(def: ConceptDef, sourceTokens: readonly string[]): EntityConcept {
  return { type: def.type, value: def.value, sourceTokens, textAliases: def.aliases };
}

function dedupe(concepts: readonly EntityConcept[]): EntityConcept[] {
  const seen = new Set<string>();
  const unique: EntityConcept[] = [];
  for (const concept of concepts) {
    const key = `${concept.type}:${concept.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(concept);
    }
  }
  return unique;
}

/**
 * How many query concepts this listing supports structurally (derived concepts agree) and
 * lexically (a naming alias appears in the listing words).
 */
export function conceptSupport(
  queryConcepts: readonly EntityConcept[],
  itemTokens: readonly string[],
  itemConcepts: readonly EntityConcept[],
): ConceptSupport {
  const words = new Set(itemTokens);
  let structural = 0;
  let lexical = 0;
  for (const concept of queryConcepts) {
    if (itemConcepts.some((item) => item.type === concept.type && item.value === concept.value)) {
      structural += 1;
    }
    if (concept.textAliases.some((alias) => aliasInTokens(alias, itemTokens, words))) {
      lexical += 1;
    }
  }
  return { structural, lexical };
}

/**
 * Which query concepts hold structurally and lexically, named for the score breakdown:
 * "colour BLUE" instead of a bare count, so a demoted listing explains itself.
 */
export function conceptDetail(
  queryConcepts: readonly EntityConcept[],
  itemTokens: readonly string[],
  itemConcepts: readonly EntityConcept[],
): ConceptDetail {
  const words = new Set(itemTokens);
  const structural: string[] = [];
  const lexical: string[] = [];
  for (const concept of queryConcepts) {
    const label = `${concept.type} ${concept.value}`;
    if (
      itemConcepts.some((entry) => entry.type === concept.type && entry.value === concept.value)
    ) {
      structural.push(label);
    }
    if (concept.textAliases.some((alias) => aliasInTokens(alias, itemTokens, words))) {
      lexical.push(label);
    }
  }
  return { structural, lexical };
}

/** Every query concept holds textually or structurally, even when a raw token is missing. */
export function satisfiesConcepts(
  queryConcepts: readonly EntityConcept[],
  itemTokens: readonly string[],
  itemConcepts: readonly EntityConcept[],
): boolean {
  const words = new Set(itemTokens);
  return queryConcepts.every(
    (concept) =>
      itemConcepts.some((item) => item.type === concept.type && item.value === concept.value) ||
      concept.textAliases.some((alias) => aliasInTokens(alias, itemTokens, words)),
  );
}

function aliasInTokens(
  alias: string,
  tokens: readonly string[],
  words: ReadonlySet<string>,
): boolean {
  if (!alias.includes(" ")) {
    return words.has(alias);
  }
  const parts = alias.split(" ");
  return tokens.some((_, index) => parts.every((part, offset) => tokens[index + offset] === part));
}
