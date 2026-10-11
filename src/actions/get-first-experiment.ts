import { createApp } from "../di.ts";

export interface ExperimentOutcome {
  readonly matched: number;
  readonly titles: readonly string[];
}

export interface FirstExperiment {
  readonly query: string;
  readonly corpusSize: number;
  /** Chapter 2 with synonyms off: the buyer's word is not the seller's word. */
  readonly off: ExperimentOutcome;
  /** Chapter 2 with synonyms on. */
  readonly on: ExperimentOutcome;
}

const QUERY = "carpet";
const LEVEL = "level-1-normalization";
const SHOWN = 3;

/** The opening experiment of the book, computed on the server so the first page needs no request. */
export async function handleGetFirstExperiment(): Promise<FirstExperiment> {
  const app = await createApp();
  const run = async (synonyms: boolean): Promise<ExperimentOutcome> => {
    const output = await app.search({
      queryText: QUERY,
      levelId: LEVEL,
      leverOverrides: { stemming: true, synonyms, variants: true },
      limit: SHOWN,
    });
    return {
      matched: output.candidateWidth,
      titles: output.results.map((result) => result.item.title),
    };
  };
  const [off, on] = await Promise.all([run(false), run(true)]);
  return { query: QUERY, corpusSize: app.corpusSize(), off, on };
}
