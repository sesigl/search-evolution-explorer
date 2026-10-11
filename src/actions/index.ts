import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { UseCaseError } from "../domain/search/errors.ts";
import { handleCompareLevels } from "./compare-levels.ts";
import { handleGetBiasLesson } from "./get-bias-lesson.ts";
import { handleGetGuidedExample } from "./get-guided-example.ts";
import { handleGetLevelSource } from "./get-level-source.ts";
import { handleGetLevels } from "./get-levels.ts";
import { handleGetScorecard } from "./get-scorecard.ts";
import { handleSearch } from "./search.ts";

const leverOverridesSchema = z
  .object({
    stemming: z.boolean().optional(),
    synonyms: z.boolean().optional(),
    variants: z.boolean().optional(),
  })
  .optional();

export const server = {
  search: defineAction({
    input: z.object({
      queryText: z.string().trim().min(1).max(200),
      levelId: z.string().min(1),
      leverOverrides: leverOverridesSchema,
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      try {
        return await handleSearch(input);
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  compareLevels: defineAction({
    input: z.object({
      queryText: z.string().trim().min(1).max(200),
      leftLevelId: z.string().min(1),
      rightLevelId: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      try {
        if (input.limit === undefined) {
          return await handleCompareLevels({
            queryText: input.queryText,
            leftLevelId: input.leftLevelId,
            rightLevelId: input.rightLevelId,
          });
        }
        return await handleCompareLevels({
          queryText: input.queryText,
          leftLevelId: input.leftLevelId,
          rightLevelId: input.rightLevelId,
          limit: input.limit,
        });
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  getLevels: defineAction({
    handler: async () => {
      try {
        return await handleGetLevels();
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  getLevelSource: defineAction({
    input: z.object({
      levelId: z.string().min(1),
    }),
    handler: async (input) => {
      try {
        return await handleGetLevelSource(input);
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  getGuidedExample: defineAction({
    input: z.object({
      levelId: z.string().min(1),
    }),
    handler: async (input) => {
      try {
        return await handleGetGuidedExample(input);
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  getBiasLesson: defineAction({
    handler: async () => {
      try {
        return await handleGetBiasLesson();
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
  getScorecard: defineAction({
    input: z.object({
      levelIds: z.array(z.string().min(1)).optional(),
    }),
    handler: async (input) => {
      try {
        return await handleGetScorecard(input.levelIds);
      } catch (error) {
        throw mapError(error);
      }
    },
  }),
};

function mapError(error: unknown): ActionError {
  if (error instanceof UseCaseError) {
    return new ActionError({ code: error.code, message: error.message });
  }
  throw error;
}
