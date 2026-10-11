import { createEffect, createSignal, For, on, onMount, Show } from "solid-js";
import type { Checkpoint as CheckpointData } from "../../actions/get-checkpoint.ts";
import Terms from "./Terms.tsx";

interface Props {
  levelId: string;
  ordinal: number;
  query: string;
}

/** The introduction's lab, opened on this query and this chapter. */
export function gradeHref(query: string, levelId: string): string {
  const params = new URLSearchParams({ level: "level-0-evaluation", grade: levelId });
  if (query !== "") {
    params.set("q", query);
  }
  return `/search?${params.toString()}`;
}

function delta(current: number, previous: number): string {
  const difference = current - previous;
  return `${difference < 0 ? "−" : "+"}${Math.abs(difference).toFixed(3)}`;
}

/**
 * The end of every chapter that runs: the same answer key as the introduction, applied to
 * this chapter and the one before it. The number moves when the chapter helped.
 */
export default function Checkpoint(props: Props) {
  const [data, setData] = createSignal<CheckpointData | null>(null);
  const [pending, setPending] = createSignal(true);
  const cache = new Map<string, CheckpointData | null>();
  let generation = 0;

  async function refresh() {
    generation += 1;
    const mine = generation;
    const key = `${props.levelId}|${props.query}`;
    const known = cache.get(key);
    if (known !== undefined) {
      setData(known);
      setPending(false);
      return;
    }
    setPending(true);
    const params = new URLSearchParams({ level: props.levelId, q: props.query });
    const response = await fetch(`/api/checkpoint.json?${params.toString()}`);
    const body = response.ok ? ((await response.json()) as CheckpointData | null) : null;
    cache.set(key, body);
    if (mine === generation) {
      setData(body);
      setPending(false);
    }
  }

  onMount(() => {
    void refresh();
  });
  createEffect(on([() => props.levelId, () => props.query], () => void refresh(), { defer: true }));

  const best = () => Math.max(...(data()?.rungs.map((rung) => rung.ndcgAt10) ?? [0]), 0.0001);
  const improved = () => {
    const current = data();
    return current?.previous !== null && current !== null
      ? current.ndcgAt10 >= current.previous.ndcgAt10
      : true;
  };

  return (
    <section
      class="card flex flex-col gap-3 px-[18px] py-4 transition-opacity"
      classList={{ "opacity-70": pending() }}
      aria-label="Checkpoint"
      aria-busy={pending()}
    >
      <div class="flex items-baseline justify-between gap-3">
        <span class="eyebrow tracking-[0.06em]">Checkpoint · end of chapter {props.ordinal}</span>
        <span class="tag tag-score">the answer key</span>
      </div>
      <h2 class="m-0 font-serif text-[19px] font-semibold leading-tight tracking-[-0.005em]">
        Did chapter {props.ordinal} make search better?
      </h2>

      <Show
        when={data()}
        fallback={
          <p class="note m-0">
            {pending()
              ? props.levelId.startsWith("level-4-") ||
                props.levelId.startsWith("level-5-") ||
                props.levelId.startsWith("level-6-")
                ? "Grading every judged query, including the neural chapters. The first run can take several minutes; later checkpoints reuse the results. You can keep searching."
                : "Grading the test queries on the earlier chapters. This takes a moment the first time."
              : "This chapter cannot be graded on this machine right now."}
          </p>
        }
      >
        {(current) => (
          <>
            <div class="flex flex-wrap items-end gap-x-5 gap-y-2">
              <Show when={current().previous}>
                {(previous) => (
                  <>
                    <div>
                      <div class="eyebrow">Chapter {previous().ordinal}</div>
                      <div class="font-mono text-[28px] leading-none text-ink-3">
                        {previous().ndcgAt10.toFixed(3)}
                      </div>
                    </div>
                    <span class="pb-1 text-ink-4" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </Show>
              <div>
                <div class="eyebrow">Chapter {current().ordinal}</div>
                <div class="font-mono text-[28px] leading-none text-ink">
                  {current().ndcgAt10.toFixed(3)}
                </div>
              </div>
              <Show when={current().previous}>
                {(previous) => (
                  <span
                    class="rounded-md px-2 py-1 font-mono text-[13px] font-semibold"
                    classList={{
                      "bg-green-soft text-green": improved(),
                      "bg-red-soft text-red": !improved(),
                    }}
                  >
                    {delta(current().ndcgAt10, previous().ndcgAt10)}
                  </span>
                )}
              </Show>
            </div>
            <Show when={current().rungs.find((rung) => rung.levelId === current().levelId)}>
              {(rung) => (
                <p class="m-0 rounded-md bg-amber-tint/60 px-2.5 py-1.5 text-[12.5px] leading-snug text-ink-2">
                  A relevant listing reached the top 10 for {rung().foundCount} of{" "}
                  {current().queryCount} test queries
                  <Show when={current().previous}>
                    {(previous) => (
                      <span>
                        {" "}
                        (chapter {previous().ordinal}: {previous().foundCount})
                      </span>
                    )}
                  </Show>
                  . Watch the change between chapters. The scorecard splits the same numbers by the
                  trap each chapter is built to fix.
                </p>
              )}
            </Show>
            <p class="m-0 text-[12.5px] leading-snug text-ink-3">
              <Show
                when={current().previous}
                fallback={
                  <Terms
                    text={`Chapter 1 sets the baseline: the average NDCG@10 over all ${current().queryCount} test queries, graded by the answer key from the introduction. Every later chapter is measured against this number. 1.000 is the best possible order.`}
                  />
                }
              >
                <Terms
                  text={`Average NDCG@10 over all ${current().queryCount} test queries, graded by the same answer key as the introduction. 1.000 is the best possible order.`}
                />
              </Show>
            </p>

            <Show when={props.levelId === "level-6-two-tower"}>
              <Show
                when={current().heldOut}
                fallback={
                  <p class="note m-0">
                    This overall checkpoint includes tower training and validation queries.{" "}
                    <a href="/scorecard?split=test&level=level-6-two-tower">
                      Check the held-out query results →
                    </a>
                  </p>
                }
              >
                {(held) => (
                  <p class="note m-0">
                    The number above includes the queries used to train and validate chapter 11, so
                    it is optimistic. On the {held().queryCount} held-out test queries, chapter 11
                    scores <strong class="font-mono">{held().ndcgAt10.toFixed(3)}</strong>.{" "}
                    <a href="/scorecard?split=test&level=level-6-two-tower">
                      Open the held-out scorecard →
                    </a>
                  </p>
                )}
              </Show>
            </Show>
            <div>
              <div class="eyebrow mb-1.5">Where we are</div>
              <ul class="m-0 flex list-none flex-col gap-1 p-0">
                <For each={current().rungs}>
                  {(rung) => (
                    <li
                      class="grid grid-cols-[18px_1fr_48px] items-center gap-2 text-xs"
                      classList={{ "font-semibold": rung.levelId === current().levelId }}
                    >
                      <span class="font-mono text-ink-3">{rung.ordinal}</span>
                      <span class="h-2 overflow-hidden rounded-sm bg-paper-2" aria-hidden="true">
                        <span
                          class="block h-full rounded-sm transition-[width] duration-500"
                          classList={{
                            "bg-amber": rung.levelId === current().levelId,
                            "bg-rule-2": rung.levelId !== current().levelId,
                          }}
                          style={{ width: `${Math.round((rung.ndcgAt10 / best()) * 100)}%` }}
                        />
                      </span>
                      <span class="text-right font-mono text-ink">{rung.ndcgAt10.toFixed(3)}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>

            <div class="rounded-lg bg-paper px-3 py-2.5 text-[12.5px] leading-snug text-ink-2">
              <Show
                when={current().forQuery}
                fallback={
                  <>
                    <Show
                      when={props.query !== ""}
                      fallback={<span>Type a query, and this box grades it too.</span>}
                    >
                      <span>
                        “{props.query}” is not one of the test queries, so it has no grades in the
                        answer key. The average above still holds.
                      </span>
                    </Show>{" "}
                    <a class="font-semibold" href={gradeHref("", props.levelId)}>
                      Grade a test query row by row →
                    </a>
                  </>
                }
              >
                {(row) => (
                  <>
                    <span>
                      For “{row().queryText}”:{" "}
                      <Show when={row().previousNdcgAt10 !== null}>
                        <span class="font-mono text-ink-3">
                          {(row().previousNdcgAt10 ?? 0).toFixed(3)}
                        </span>{" "}
                        →{" "}
                      </Show>
                      <strong class="font-mono text-ink">{row().ndcgAt10.toFixed(3)}</strong>
                    </span>{" "}
                    <a class="font-semibold" href={gradeHref(row().queryText, props.levelId)}>
                      Grade this top 10 in the introduction →
                    </a>
                  </>
                )}
              </Show>
            </div>

            <Show when={current().previous !== null && current().regressionCount > 0}>
              <p class="m-0 text-[12.5px] leading-snug text-ink-3">
                Lower than chapter {current().previous?.ordinal} on {current().regressionCount} of{" "}
                {current().queryCount} test queries
                <Show when={current().worstRegression}>
                  {(worst) => (
                    <span>
                      , and a drop can be large: −{Math.abs(worst().delta).toFixed(3)} on “
                      {worst().queryText}”
                    </span>
                  )}
                </Show>
                . Better on average is not better everywhere.{" "}
                <a
                  class="font-semibold"
                  href={`/scorecard?level=${encodeURIComponent(current().levelId)}#regressions-heading`}
                >
                  See which →
                </a>
              </p>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
