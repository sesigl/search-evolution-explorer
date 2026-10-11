import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import type { GradedRanking, GradedRow } from "../../actions/grade-query.ts";
import { queryIntentFor } from "../../domain/evaluation/query-intent.ts";
import type { LevelListItem } from "../../domain/levels/list-levels.ts";
import { rememberPlace } from "../shared/storage.ts";
import { GRADE_LABELS } from "./format.ts";
import Terms from "./Terms.tsx";

interface Props {
  queries: readonly string[];
  levels: readonly LevelListItem[];
  /** Query and chapter to grade first; a checkpoint link and the lesson's play buttons set them. */
  initialQuery: string;
  initialLevelId: string | null;
}

/** Dispatched on `document` with `{ query, levelId }` to grade another ranking in place. */
export const GRADE_EVENT = "see:grade";

export interface GradeRequest {
  readonly query: string;
  readonly levelId: string;
}

interface LevelScore {
  readonly levelId: string;
  readonly ndcgAt10: number | null;
}

interface GradeOutcome {
  readonly ranking: GradedRanking | null;
  /** Why the chapter could not be graded, or null when it could. */
  readonly error: string | null;
}

const DEFAULT_QUERY = "marble";

/**
 * The introduction made concrete: grade one chapter's top 10 for a judged query, show where
 * every point of the metric comes from, and compare the number across the chapters that run.
 */
export default function EvaluationLab(props: Props) {
  // Every implemented chapter can be compared, but only a chapter whose artifacts are ready
  // can actually run and be graded. A stale chapter would answer with an error, so it is
  // listed as not gradable instead of being offered and failing.
  const chapters = () => props.levels.filter((level) => level.implemented && level.ordinal > 0);
  const gradable = () => chapters().filter((level) => level.prerequisiteState === "ready");
  const blockedChapters = () => chapters().filter((level) => level.prerequisiteState !== "ready");
  function initialLevel(): string {
    if (gradable().some((level) => level.id === props.initialLevelId)) {
      return props.initialLevelId ?? "level-1-recency";
    }
    return gradable()[0]?.id ?? "level-1-recency";
  }
  const firstQuery = props.queries.includes(props.initialQuery)
    ? props.initialQuery
    : props.queries.includes(DEFAULT_QUERY)
      ? DEFAULT_QUERY
      : (props.queries[0] ?? "");
  const [query, setQuery] = createSignal(firstQuery);
  const [levelId, setLevelId] = createSignal(initialLevel());
  const [graded, setGraded] = createSignal<GradedRanking | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [scores, setScores] = createSignal<readonly LevelScore[]>([]);
  const [showIdeal, setShowIdeal] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  // A lesson button that asks for the state already shown must still show that something
  // happened, so the card flashes and scrolls into view on every request.
  const [flash, setFlash] = createSignal(false);
  let section: HTMLElement | undefined;
  let generation = 0;

  async function fetchGrade(queryText: string, id: string): Promise<GradeOutcome> {
    try {
      const response = await fetch(
        `/api/grade.json?q=${encodeURIComponent(queryText)}&level=${encodeURIComponent(id)}`,
      );
      if (response.ok) {
        return { ranking: (await response.json()) as GradedRanking, error: null };
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ranking: null, error: body?.error ?? `Chapter ${id} could not be graded.` };
    } catch {
      return { ranking: null, error: "The grading endpoint could not be reached." };
    }
  }

  async function refresh() {
    generation += 1;
    const mine = generation;
    setPending(true);
    const queryText = query();
    const ready = gradable();
    const [main, ...others] = await Promise.all([
      fetchGrade(queryText, levelId()),
      ...ready.map(async (level) => ({
        levelId: level.id,
        ndcgAt10: (await fetchGrade(queryText, level.id)).ranking?.ndcgAt10 ?? null,
      })),
    ]);
    if (mine !== generation) {
      return;
    }
    setGraded(main.ranking);
    setError(main.error);
    // A chapter whose artifacts are not ready is never asked; it compares as "n/a".
    const readyScores = new Map(others.map((score) => [score.levelId, score.ndcgAt10]));
    setScores(
      chapters().map((level) => ({
        levelId: level.id,
        ndcgAt10: readyScores.get(level.id) ?? null,
      })),
    );
    setPending(false);
  }

  onMount(() => {
    void refresh();
    const onGrade = (event: Event) => {
      const request = (event as CustomEvent<GradeRequest>).detail;
      if (props.queries.includes(request.query)) {
        setQuery(request.query);
      }
      if (gradable().some((level) => level.id === request.levelId)) {
        setLevelId(request.levelId);
      }
      section?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    };
    document.addEventListener(GRADE_EVENT, onGrade);
    onCleanup(() => document.removeEventListener(GRADE_EVENT, onGrade));
  });
  createEffect(
    on(
      [query, levelId],
      () => {
        // A new ranking is graded: show its real top 10, not the ideal order of the previous one.
        setShowIdeal(false);
        void refresh();
      },
      { defer: true },
    ),
  );

  // The contents page offers "continue"; from the lab, that means this query and this chapter.
  createEffect(
    on([query, levelId], () => {
      const params = new URLSearchParams({ level: "level-0-evaluation", grade: levelId() });
      if (query() !== "") {
        params.set("q", query());
      }
      rememberPlace({ levelId: levelId(), query: query(), href: `/search?${params.toString()}` });
    }),
  );

  const labelOf = (id: string) => {
    const level = props.levels.find((entry) => entry.id === id);
    return level === undefined ? id : `chapter ${level.ordinal} · ${level.label}`;
  };
  const isGradable = (id: string) => gradable().some((level) => level.id === id);
  const relevantShown = () => graded()?.rows.filter((row) => row.grade > 0).length ?? 0;
  const intent = () => queryIntentFor(query());
  const bestScore = () => Math.max(...scores().map((score) => score.ndcgAt10 ?? 0), 0.0001);
  const allTied = () => {
    const values = scores()
      .map((score) => score.ndcgAt10)
      .filter((value): value is number => value !== null);
    return values.length > 1 && new Set(values.map((value) => value.toFixed(3))).size === 1;
  };

  return (
    <section
      ref={section}
      class="card flex flex-col transition-shadow duration-300"
      classList={{ "shadow-[0_0_0_3px_var(--color-amber)]": flash() }}
      aria-label="Grade a ranking"
    >
      <div class="flex flex-wrap items-end gap-3 border-b border-rule px-5 py-4">
        <label class="flex min-w-[180px] grow flex-col gap-1 text-xs font-semibold text-ink-3">
          Test query (only queries in the answer key can be graded)
          <select
            class="select h-10 text-[13.5px]"
            value={query()}
            onChange={(event) => setQuery(event.currentTarget.value)}
          >
            <For each={props.queries}>
              {(entry) => (
                <option value={entry} selected={entry === query()}>
                  {entry}
                </option>
              )}
            </For>
          </select>
          <Show when={intent()}>
            {(text) => (
              <span class="font-normal text-ink-3">
                The searcher wants <span class="text-ink-2">{text()}</span>. The answer key grades
                that meaning, not every meaning of the word.
              </span>
            )}
          </Show>
        </label>
        <label class="flex min-w-[220px] grow flex-col gap-1 text-xs font-semibold text-ink-3">
          Ranking to grade
          <select
            class="select h-10 text-[13.5px]"
            value={levelId()}
            onChange={(event) => setLevelId(event.currentTarget.value)}
          >
            <For each={gradable()}>
              {(level) => (
                <option value={level.id} selected={level.id === levelId()}>
                  {level.ordinal} · {level.label}
                </option>
              )}
            </For>
          </select>
        </label>
        <Show when={blockedChapters().length > 0}>
          <p class="m-0 w-full text-[11.5px] font-normal text-ink-3">
            Not gradable yet:{" "}
            {blockedChapters()
              .map(
                (level) =>
                  `${level.ordinal} · ${level.label} (${level.prerequisiteState}, run ${level.rebuildCommand})`,
              )
              .join("; ")}
            .
          </p>
        </Show>
      </div>

      <div
        class="grid gap-5 px-5 py-4 transition-opacity 2xl:grid-cols-[240px_1fr]"
        classList={{ "opacity-60": pending() }}
      >
        <div class="flex flex-col gap-3">
          <div>
            <div class="eyebrow">NDCG@10 of this ranking</div>
            <div class="mt-1 font-mono text-[44px] leading-none tracking-[-0.02em]">
              {graded() === null ? "–" : (graded()?.ndcgAt10 ?? 0).toFixed(3)}
            </div>
            <div class="mt-1.5 text-[12.5px] text-ink-3">
              {showIdeal()
                ? "This is still the real score of the chapter. The table now shows the order that would score 1.000."
                : "1.000 = the best possible order"}
            </div>
          </div>
          <Show when={graded()}>
            {(current) => (
              <p class="note m-0 font-serif text-[13.5px] leading-snug text-ink">
                The answer key grades <strong>{current().judgedCount}</strong> listings for this
                query. <strong>{relevantShown()}</strong> of them{" "}
                {relevantShown() === 1 ? "is" : "are"} in this top 10, and{" "}
                <strong>{current().missedCount}</strong> relevant ones sit further down the list,
                where they earn nothing. NDCG@10 only looks at this top 10: if every row is already
                a 3, the number is 1.000 even when hundreds are missed. Try marble, area rug, black
                leather chair, or iphne to see a chapter move the score.
              </p>
            )}
          </Show>
          <div>
            <div class="eyebrow mb-1.5">Same query, every chapter</div>
            <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
              <For each={scores()}>
                {(score) => (
                  <li>
                    <button
                      type="button"
                      disabled={!isGradable(score.levelId)}
                      title={
                        isGradable(score.levelId)
                          ? undefined
                          : "This chapter's artifacts are not ready, so it cannot run yet."
                      }
                      onClick={() => setLevelId(score.levelId)}
                      class="grid w-full cursor-pointer grid-cols-[18px_1fr_48px] items-center gap-2 rounded-md border-0 bg-transparent px-1 py-0.5 text-left font-sans text-xs hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      classList={{ "bg-paper": score.levelId === levelId() }}
                      aria-pressed={score.levelId === levelId()}
                    >
                      <span class="font-mono text-ink-3">
                        {props.levels.find((level) => level.id === score.levelId)?.ordinal ??
                          score.levelId.split("-")[1]}
                      </span>
                      <span class="h-2 overflow-hidden rounded-sm bg-paper-2" aria-hidden="true">
                        <span
                          class="block h-full rounded-sm bg-amber transition-[width] duration-500"
                          style={{
                            width: `${Math.round(((score.ndcgAt10 ?? 0) / bestScore()) * 100)}%`,
                          }}
                        />
                      </span>
                      <span class="text-right font-mono text-ink">
                        {score.ndcgAt10 === null ? "n/a" : score.ndcgAt10.toFixed(3)}
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <Show when={allTied()}>
              <p class="note m-0 mt-2 text-[12px]">
                All chapters score the same here: the later chapters found more listings, but none
                of the new ones is graded relevant, so nothing moved. Wider matching only helps when
                the extra finds are good.
              </p>
            </Show>
            <p class="m-0 mt-1.5 text-[11.5px] text-ink-4">
              Click a chapter to grade it. A later chapter is not always better on every query: each
              chapter adds a rule that helps some queries and hurts others. The answer key shows
              which, and the scorecard sums it up over all test queries.
            </p>
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[13px] font-semibold">
              {showIdeal() ? "The best possible top 10" : `Top 10 of ${labelOf(levelId())}`}
            </span>
            <label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-2">
              <input
                type="checkbox"
                checked={showIdeal()}
                onChange={(event) => setShowIdeal(event.currentTarget.checked)}
              />
              show the best possible order
            </label>
          </div>
          <Show
            when={graded()}
            fallback={
              <p class="note m-0">
                {pending()
                  ? "Grading the ranking…"
                  : (error() ?? "This chapter returned nothing for this query.")}
              </p>
            }
          >
            {(current) => <GradedRows rows={showIdeal() ? current().ideal : current().rows} />}
          </Show>
          <p class="m-0 mt-3 text-[12.5px] leading-snug text-ink-3">
            <Terms text="Each row earns (2^grade − 1) ÷ log2(position + 1): a grade 3 at position 1 earns 7.0, the same grade at position 10 earns 2.0, a grade 0 earns nothing. The sum is divided by the sum of the best possible order, so the result is 1.0 when nothing can be improved. That is NDCG@10." />
          </p>
        </div>
      </div>
    </section>
  );
}

function GradedRows(props: { rows: readonly GradedRow[] }) {
  return (
    <ol class="m-0 list-none rounded-lg border border-rule-soft p-0">
      <li class="eyebrow grid grid-cols-[28px_1fr_96px_56px] gap-2 border-b border-rule-soft px-3 py-1.5">
        <span>#</span>
        <span>Listing</span>
        <span>Grade</span>
        <span class="text-right">Earns</span>
      </li>
      <Show
        when={props.rows.length > 0}
        fallback={
          <li class="px-3 py-3 text-xs text-ink-3">
            This chapter returned nothing for this query.
          </li>
        }
      >
        <For each={props.rows}>
          {(row) => (
            <li class="grid grid-cols-[28px_1fr_96px_56px] items-center gap-2 border-b border-rule-soft px-3 py-1.5 text-[13px] last:border-b-0">
              <span class="font-mono text-ink-4">{row.position}</span>
              <span class="truncate font-serif text-[14.5px]">{row.title}</span>
              <span class={`tag grade-${row.grade}`}>
                {row.grade} · {GRADE_LABELS[row.grade] ?? ""}
              </span>
              <span class="text-right font-mono text-ink">{row.gain.toFixed(2)}</span>
            </li>
          )}
        </For>
      </Show>
    </ol>
  );
}
