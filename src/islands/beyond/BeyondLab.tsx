import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { WorkbenchState } from "../../actions/search-workbench.ts";

/** The base engine both demos build on: hybrid retrieval, the same serving path the chapters use. */
const BASE_LEVEL = "level-4-hybrid";
const DEFAULT_QUERY = "sofa";
const MAX_ROWS = 10;

interface Row {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string;
  readonly priceCents: number;
  readonly location: string;
  readonly position: number;
  /** Cosine similarity to the query, when the base engine exposes it (chapter 9 does). */
  readonly similarity: number | null;
}

interface Persona {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly categoryId: string;
  readonly city: string;
}

const PERSONAS: readonly Persona[] = [
  {
    id: "cyclist",
    label: "A cyclist in Berlin",
    note: "Looks for bikes and bike parts, and buys locally.",
    categoryId: "vehicles",
    city: "Berlin",
  },
  {
    id: "photographer",
    label: "A photographer in Munich",
    note: "Looks for cameras and electronics, and buys locally.",
    categoryId: "electronics",
    city: "Munich",
  },
  {
    id: "homemaker",
    label: "Someone furnishing a flat in Hamburg",
    note: "Looks for furniture and home goods, and buys locally.",
    categoryId: "furniture",
    city: "Hamburg",
  },
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "from",
  "this",
  "that",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "in",
  "on",
  "at",
  "to",
  "of",
  "it",
  "its",
  "as",
  "by",
  "we",
  "you",
  "your",
  "our",
  "sale",
  "used",
  "new",
  "free",
  "also",
  "very",
  "good",
  "every",
  "one",
  "comes",
  "two",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length >= 3 && !STOP_WORDS.has(token),
  );
}

function priceLabel(priceCents: number): string {
  return `EUR ${(priceCents / 100).toFixed(2)}`;
}

/** Words the templates add on their own; every other unknown word is an unsupported claim. */
const WRITER_WORDS = new Set(["closest", "match", "another", "good", "option", "also", "close"]);

/** A sentence is grounded when every content word either came from a source or is writer filler. */
/** A sentence is grounded when every content word came from a source or is writer filler. */
function ungroundedWords(
  sentence: string,
  corpus: ReadonlySet<string>,
  allowed: ReadonlySet<string>,
): string[] {
  return tokens(sentence).filter(
    (word) => !(corpus.has(word) || WRITER_WORDS.has(word) || allowed.has(word)),
  );
}

export default function BeyondLab() {
  const [query, setQuery] = createSignal(DEFAULT_QUERY);
  const [draft, setDraft] = createSignal(DEFAULT_QUERY);
  const [rows, setRows] = createSignal<readonly Row[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);
  const [personaId, setPersonaId] = createSignal(PERSONAS[2]?.id ?? "");
  const [weight, setWeight] = createSignal(0.5);
  const [unsupported, setUnsupported] = createSignal(false);

  async function run(next: string) {
    setPending(true);
    setError(null);
    const trimmed = next.trim();
    if (trimmed === "") {
      setError("Type a query to retrieve listings.");
      setRows([]);
      setPending(false);
      return;
    }
    const params = new URLSearchParams({ q: trimmed, level: BASE_LEVEL });
    try {
      const response = await fetch(`/api/search.json?${params.toString()}`);
      const body = (await response.json()) as WorkbenchState;
      if (body.error !== null || body.view === null) {
        setError(body.error?.message ?? "This level is not available right now.");
        setRows([]);
      } else if (body.view.results.length === 0) {
        setError(`No listing matched “${trimmed}”, so there is nothing to ground an answer in.`);
        setRows([]);
      } else {
        setQuery(trimmed);
        setRows(
          body.view.results.slice(0, MAX_ROWS).map((row) => ({
            ...row,
            similarity:
              row.signals.find((signal) => signal.name === "vectorSimilarity")?.value ?? null,
          })),
        );
      }
    } catch {
      setError("The search request failed. Is the app still running?");
      setRows([]);
    }
    setPending(false);
  }

  onMount(() => void run(DEFAULT_QUERY));

  const corpus = createMemo(() => {
    const words = new Set<string>();
    for (const row of rows()) {
      const source = `${row.title} ${row.description} ${row.categoryId} ${row.location} ${priceLabel(row.priceCents)}`;
      for (const token of tokens(source)) {
        words.add(token);
      }
    }
    return words;
  });

  const sentences = createMemo(() => {
    const list = rows();
    const sentences: { text: string; citation: number | null }[] = [];
    const [first, second] = list;
    if (first !== undefined) {
      sentences.push({
        text: `${first.title} is the closest match for ${query()}, at ${priceLabel(first.priceCents)} in ${first.location}.`,
        citation: 1,
      });
    }
    if (second !== undefined) {
      sentences.push({
        text: `Another good option is ${second.title}, at ${priceLabel(second.priceCents)}.`,
        citation: 2,
      });
    }
    const rest = list.slice(2, 5).map((row) => row.title);
    if (rest.length > 0) {
      sentences.push({
        text: `Also close: ${rest.join(", ")}.`,
        citation: null,
      });
    }
    if (unsupported()) {
      sentences.push({
        text: "Every one of these comes with a two-year warranty and free shipping.",
        citation: null,
      });
    }
    return sentences;
  });

  const persona = () => PERSONAS.find((entry) => entry.id === personaId()) ?? PERSONAS[0];

  /** The user's own words are not claims about a listing; never flag them. */
  const queryWords = createMemo(() => new Set(tokens(query())));

  /**
   * True when at least one retrieved listing shares a word with the query, or the best meaning
   * similarity is high enough. A gibberish query has neither, and must not get a confident answer.
   */
  const hasEvidence = createMemo(() => {
    const words = corpus();
    const shared = [...queryWords()].some((word) => words.has(word));
    return shared || (rows()[0]?.similarity ?? 0) >= 0.3;
  });

  /** Content words the answer uses that appear in none of the retrieved listings. */
  const unsupportedWords = createMemo(() => {
    if (!hasEvidence()) {
      return [];
    }
    const words = new Set<string>();
    for (const sentence of sentences()) {
      for (const word of ungroundedWords(sentence.text, corpus(), queryWords())) {
        words.add(word);
      }
    }
    return [...words];
  });

  function affinity(row: Row): number {
    const chosen = persona();
    if (chosen === undefined) {
      return 0;
    }
    return (row.categoryId === chosen.categoryId ? 1 : 0) + (row.location === chosen.city ? 1 : 0);
  }

  const reranked = createMemo(() => {
    const list = rows();
    const size = Math.max(list.length, 1);
    return list
      .map((row) => {
        const base = (size - row.position + 1) / size;
        const boost = (weight() * affinity(row)) / 2;
        return { row, base, boost, final: base + boost };
      })
      .sort((left, right) => right.final - left.final);
  });

  const moved = createMemo(
    () => reranked().filter((entry, index) => entry.row.position !== index + 1).length,
  );

  return (
    <div class="flex flex-col gap-[18px]">
      <section class="card flex flex-wrap items-end gap-3 px-[18px] py-4">
        <label class="flex min-w-[220px] grow flex-col gap-1 text-xs font-semibold text-ink-3">
          Query
          <input
            class="input"
            type="search"
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void run(draft());
              }
            }}
            maxlength="200"
            autocomplete="off"
          />
        </label>
        <button
          type="button"
          class="btn h-11"
          disabled={pending()}
          onClick={() => void run(draft())}
        >
          {pending() ? "Searching…" : "Retrieve"}
        </button>
        <span class="text-[12.5px] text-ink-3">
          Base engine: chapter 9, hybrid retrieval. Both demos re-use these same results.
        </span>
      </section>

      <Show when={error()}>
        {(message) => (
          <section class="card px-[18px] py-4 text-[14px] text-ink-2" role="status">
            {message()}
          </section>
        )}
      </Show>

      <div class="grid min-w-0 items-start gap-[18px] lg:grid-cols-2">
        <section class="card flex min-w-0 flex-col gap-3" aria-label="Grounded answer demo">
          <header class="border-b border-rule px-4 py-3">
            <span class="eyebrow">Book chapter 14 · question answering</span>
            <h2 class="h2 mt-1">An answer, with its sources, on top of the same results</h2>
          </header>
          <div class="flex flex-col gap-3 px-4 pb-4">
            <p class="m-0 text-[14px] leading-relaxed text-ink-2">
              Retrieval-augmented generation returns prose, not a list. The loop is: retrieve, write
              only from what was retrieved, cite it, then check the claims back against the sources.
              This demo writes the sentences from listing fields with fixed templates, so the loop
              is visible without a language model. A real system replaces the writer, not the
              retrieve–cite–verify contract.
            </p>
            <Show
              when={hasEvidence()}
              fallback={
                <p class="m-0 rounded-lg border border-rule bg-surface-warm px-3.5 py-3 font-serif text-[15px] leading-relaxed text-ink-2">
                  No listing shares a word with “{query()}”, and nothing is close in meaning. There
                  is no evidence to write an answer from. Try a product word such as “sofa” or
                  “camera”.
                </p>
              }
            >
              <div class="break-words rounded-lg border border-rule bg-surface-warm px-3.5 py-3 font-serif text-[15px] leading-relaxed">
                <For each={sentences()}>
                  {(sentence) => {
                    const missing = () => ungroundedWords(sentence.text, corpus(), queryWords());
                    const ok = () => missing().length === 0;
                    return (
                      <span class="mr-1" classList={{ "rounded bg-red-soft px-1 text-red": !ok() }}>
                        {sentence.text}
                        <Show when={sentence.citation}>
                          {(citation) => (
                            <sup class="ml-0.5 font-sans text-[11px]">[{citation()}]</sup>
                          )}
                        </Show>{" "}
                      </span>
                    );
                  }}
                </For>
              </div>
            </Show>
            <Show when={unsupportedWords().length > 0}>
              <p class="m-0 text-[12.5px] text-red">
                Unsupported words: <span class="font-mono">{unsupportedWords().join(", ")}</span>
              </p>
            </Show>
            <label class="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
              <input
                type="checkbox"
                class="peer sr-only"
                checked={unsupported()}
                onChange={() => setUnsupported((value) => !value)}
              />
              <span
                aria-hidden="true"
                class="relative h-[18px] w-[30px] rounded-full transition-colors after:absolute after:top-0.5 after:h-[14px] after:w-[14px] after:rounded-full after:bg-surface after:transition-[left] peer-checked:bg-amber after:left-0.5 peer-checked:after:left-[14px]"
              />
              Add a claim the listings do not support
            </label>
            <p class="m-0 text-[12.5px] leading-snug text-ink-3">
              The checker tokenises each sentence and looks for its content words in the retrieved
              listings. A word that appears in none of them turns red: that is the kind of
              unsupported claim a stronger verifier would stop before the answer reaches a person.
              This is a token check, not entailment: it catches new claims, not a misused one.
              Retrieval bounds what can be said; the checker bounds what is allowed to stand.
            </p>
            <ol class="m-0 list-none p-0 text-[12.5px] text-ink-3">
              <For each={rows().slice(0, 5)}>
                {(row, index) => (
                  <li class="truncate py-0.5">
                    <span class="font-mono">[{index() + 1}]</span> {row.title} — {row.location}
                  </li>
                )}
              </For>
            </ol>
          </div>
        </section>

        <section class="card flex min-w-0 flex-col gap-3" aria-label="Personalisation demo">
          <header class="border-b border-rule px-4 py-3">
            <span class="eyebrow">Book chapters 8-9 · signals boosting and personalisation</span>
            <h2 class="h2 mt-1">The same results, re-ranked for one person</h2>
          </header>
          <div class="flex flex-col gap-3 px-4 pb-4">
            <p class="m-0 text-[14px] leading-relaxed text-ink-2">
              Personalisation adds a boost that depends on the searcher, not the query. The model
              below is deliberately transparent: a listing gains points when its category and city
              match the persona. A production system learns those weights from signals; here you can
              see exactly what each point is worth.
            </p>
            <div class="flex flex-wrap items-end gap-3">
              <label class="flex min-w-[220px] grow flex-col gap-1 text-xs font-semibold text-ink-3">
                Persona
                <select
                  class="select h-10 text-[13.5px]"
                  value={personaId()}
                  onChange={(event) => setPersonaId(event.currentTarget.value)}
                >
                  <For each={PERSONAS}>
                    {(entry) => (
                      <option value={entry.id} selected={entry.id === personaId()}>
                        {entry.label}
                      </option>
                    )}
                  </For>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-semibold text-ink-3">
                Boost weight {weight().toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weight()}
                  onInput={(event) => setWeight(event.currentTarget.valueAsNumber)}
                />
              </label>
            </div>
            <p class="m-0 text-[12.5px] text-ink-3">{persona()?.note}</p>
            <span class="text-[12.5px] text-ink-3">
              {moved()} of {rows().length} listings move. At weight 0 this is chapter 9's order.
            </span>
            <ol class="m-0 list-none p-0">
              <For each={reranked()}>
                {(entry, index) => (
                  <li class="flex items-baseline gap-2.5 border-t border-rule-soft py-1.5 text-[13px] first:border-t-0">
                    <span class="w-5 font-mono text-ink-4">{index() + 1}</span>
                    <span class="min-w-0 grow truncate">{entry.row.title}</span>
                    <span class="shrink-0 font-mono text-[11.5px] text-ink-3">
                      {entry.row.categoryId} · {entry.row.location}
                    </span>
                    <Show when={entry.boost > 0}>
                      <span class="shrink-0 rounded bg-amber-soft px-1.5 font-mono text-[11px] text-amber-deep">
                        +{entry.boost.toFixed(2)}
                      </span>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
            <p class="m-0 text-[12.5px] leading-snug text-ink-3">
              Trade-off, stated plainly: this makes the list better for one persona and worse for
              everyone else, and a profile can narrow what a person is shown. That is why the book
              treats personalisation as a boost to be measured, not a replacement for retrieval.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
