import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { CompareOutput } from "../../domain/comparison/compare-levels.ts";
import type { LevelListItem } from "../../domain/levels/list-levels.ts";
import type { SearchOutput } from "../../domain/search/run-search.ts";
import { liveJson } from "../shared/live-api.ts";
import { scoreLabelFor, signalInfo } from "./format.ts";
import ResultRows from "./ResultRows.tsx";

export default function ComparisonWorkbench(props: { levels: readonly LevelListItem[] }) {
  const [query, setQuery] = createSignal("");
  const [left, setLeft] = createSignal("level-1-recency");
  const [right, setRight] = createSignal("level-1-normalization");
  const [comparison, setComparison] = createSignal<CompareOutput | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);
  let generation = 0;

  async function run(updateUrl = true) {
    const mine = ++generation;
    setError(null);
    setComparison(null);
    setPending(false);
    if (query().trim() === "") return;
    const params = new URLSearchParams({ q: query().trim(), left: left(), right: right() });
    if (updateUrl) history.pushState(null, "", `/compare?${params.toString()}`);
    setPending(true);
    try {
      const body = await liveJson<CompareOutput>(`/api/compare.json?${params.toString()}`);
      if (mine === generation) setComparison(body);
    } catch (failure) {
      showFailure(failure, mine);
    } finally {
      if (mine === generation) setPending(false);
    }
  }

  function showFailure(failure: unknown, mine: number) {
    if (mine === generation) {
      setError(failure instanceof Error ? failure.message : "Comparison failed.");
    }
  }

  onMount(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setLeft(params.get("left") ?? "level-1-recency");
      setRight(params.get("right") ?? "level-1-normalization");
      void run(false);
    };
    restore();
    window.addEventListener("popstate", restore);
    onCleanup(() => window.removeEventListener("popstate", restore));
  });

  return (
    <div class="flex flex-col gap-[18px] px-7 pb-8 pt-6" aria-busy={pending()}>
      <form
        class="grid items-center gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px_260px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <input
          class="input"
          type="search"
          aria-label="Query"
          placeholder="One query, two levels"
          maxLength={200}
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <For
          each={[
            { label: "Left level", value: left, set: setLeft },
            { label: "Right level", value: right, set: setRight },
          ]}
        >
          {(side) => (
            <select
              class="select"
              aria-label={side.label}
              value={side.value()}
              onChange={(event) => side.set(event.currentTarget.value)}
            >
              <For each={props.levels.filter((level) => level.implemented && level.ordinal > 0)}>
                {(level) => (
                  <option value={level.id}>
                    {level.ordinal} · {level.label}
                  </option>
                )}
              </For>
            </select>
          )}
        </For>
        <button type="submit" class="btn" disabled={pending()}>
          Compare
        </button>
      </form>
      <Show when={pending()}>
        <p role="status">Comparing the two rankings…</p>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class="card p-4">
            {message()}
          </p>
        )}
      </Show>
      <Show
        when={comparison()}
        fallback={
          <p class="note">
            Enter a query and pick two levels. Both rankings appear side by side, with entered,
            exited and moved listings.
          </p>
        }
      >
        {(data) => <ComparisonResults comparison={data()} />}
      </Show>
      <noscript>
        Live comparison needs JavaScript. The chapter source and scorecards remain readable.
      </noscript>
    </div>
  );
}

function ComparisonResults(props: { comparison: CompareOutput }) {
  const data = () => props.comparison;
  const title = (id: string) =>
    [...data().left.results, ...data().right.results].find((row) => row.item.id === id)?.item
      .title ?? id;
  const rows = (side: SearchOutput) =>
    side.results.map(({ item, ...ranked }) => ({ ...item, ...ranked }));
  const matching = () => data().membershipKind === "matching";
  return (
    <div class="flex flex-col gap-[18px]">
      <section class="card p-4">
        <h2 class="h2">
          {data().identical
            ? "Both chapters produce the same ranking."
            : matching()
              ? "Matching changes which listings can enter the results."
              : "Scoring changes the order, not the candidate set."}
        </h2>
        <p class="note">
          In the top 10: {data().entered.length} entered, {data().exited.length} exited,{" "}
          {data().moved.length} moved. These counts refer to the displayed results, not all
          candidates. Scores from different chapters can use different scales.
        </p>
        <Show when={data().suggestedDistinguishingQuery}>
          {(suggestion) => (
            <a
              href={`/compare?q=${encodeURIComponent(suggestion())}&left=${data().left.level.id}&right=${data().right.level.id}`}
            >
              Try “{suggestion()}”, which distinguishes these chapters →
            </a>
          )}
        </Show>
      </section>
      <div class="grid gap-[18px] lg:grid-cols-2">
        <For each={[data().left, data().right]}>
          {(side) => (
            <section class="card" aria-label={`${side.level.label} results`}>
              <div class="flex items-center justify-between border-b border-rule px-3.5 py-3">
                <h2 class="h2">
                  {side.level.ordinal} · {side.level.label}
                </h2>
                <span class="note">{side.candidateWidth} candidates</span>
              </div>
              <ResultRows
                results={rows(side)}
                scoreLabel={scoreLabelFor(side.level.id)}
                levelId={side.level.id}
              />
            </section>
          )}
        </For>
      </div>
      <Show when={!data().identical}>
        <section class="card p-4" aria-label="Ranking changes">
          <h2 class="h2">What changed, and which signal did it</h2>
          <ul class="list-none p-0">
            <For
              each={[
                ...data().entered.map((entry) => ({ ...entry, label: "entered" })),
                ...data().exited.map((entry) => ({ ...entry, label: "exited" })),
              ]}
            >
              {(entry) => (
                <li class="border-t border-rule-soft py-2">
                  <strong>{title(entry.itemId)}</strong> · {entry.label}
                  <p class="note">{entry.reason}</p>
                </li>
              )}
            </For>
            <For each={data().moved}>
              {(entry) => (
                <li class="border-t border-rule-soft py-2">
                  <strong>{title(entry.itemId)}</strong> · {entry.fromPosition} → {entry.toPosition}
                  <p class="note">
                    {signalInfo(entry.attributedSignal).label}:{" "}
                    {signalInfo(entry.attributedSignal).meaning}
                  </p>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  );
}
