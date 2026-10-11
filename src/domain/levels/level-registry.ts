import type { EvolutionLevel } from "../types/level.ts";
import { meta as level0 } from "./level-0-evaluation.ts";
import { meta as levelCanonical } from "./level-1-canonical.ts";
import { meta as levelEntities } from "./level-1-entities.ts";
import { meta as level2 } from "./level-1-lexical.ts";
import { meta as levelNormalization } from "./level-1-normalization.ts";
import { meta as level1 } from "./level-1-recency.ts";
import { meta as levelSpelling } from "./level-1-spelling.ts";
import { meta as level3 } from "./level-2-boosting.ts";
import { meta as level4 } from "./level-3-learned.ts";
import { meta as level5 } from "./level-4-hybrid.ts";
import { meta as level6 } from "./level-5-cross-encoder.ts";
import { meta as level7 } from "./level-6-two-tower.ts";

export const levels: readonly EvolutionLevel[] = [
  level0,
  level1,
  levelNormalization,
  level2,
  levelSpelling,
  levelEntities,
  levelCanonical,
  level3,
  level4,
  level5,
  level6,
  level7,
];
