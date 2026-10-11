import { createApp } from "../di.ts";
import type { SearchInput, SearchOutput } from "../domain/search/run-search.ts";
import type { LeverOverrides } from "../domain/types/query.ts";

export async function handleSearch(input: SearchInput): Promise<SearchOutput> {
  const app = await createApp();
  return app.search(toSearchInput(input));
}

function toSearchInput(input: SearchInput): SearchInput {
  return {
    queryText: input.queryText,
    levelId: input.levelId,
    ...(input.leverOverrides === undefined
      ? {}
      : { leverOverrides: compactLevers(input.leverOverrides) }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.offset === undefined ? {} : { offset: input.offset }),
  };
}

function compactLevers(value: LeverOverrides): LeverOverrides {
  return {
    ...(value.stemming === undefined ? {} : { stemming: value.stemming }),
    ...(value.synonyms === undefined ? {} : { synonyms: value.synonyms }),
    ...(value.variants === undefined ? {} : { variants: value.variants }),
  };
}
