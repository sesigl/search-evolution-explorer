import { createMemo, createSignal, For, Show } from "solid-js";
import type { BiasLogExample, BiasLogItem } from "../../domain/ranking/bias-lesson.ts";

interface BiasLabProps {
  readonly examples: readonly BiasLogExample[];
  readonly titles: Readonly<Record<string, string>>;
  readonly learnedChapter: number;
}

const MIN_PROPENSITY = 0.05;
const MAX_IPS = 8;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type SortKey = "naive" | "corrected";

function score(item: BiasLogItem, key: SortKey): number {
  return key === "naive" ? item.naiveScore : item.correctedScore;
}

function ordered(items: readonly BiasLogItem[], key: SortKey): BiasLogItem[] {
  return [...items].sort((left, right) => {
    const difference = score(right, key) - score(left, key);
    return difference === 0 ? left.itemId.localeCompare(right.itemId) : difference;
  });
}

function ranksOf(items: readonly BiasLogItem[], key: SortKey): Map<string, number> {
  const ranks = new Map<string, number>();
  ordered(items, key).forEach((item, index) => {
    ranks.set(item.itemId, index + 1);
  });
  return ranks;
}

function titleOf(props: BiasLabProps, itemId: string): string {
  return props.titles[itemId] ?? itemId;
}

export default function BiasLab(props: BiasLabProps) {
  const [queryIndex, setQueryIndex] = createSignal(0);
  const [sortKey, setSortKey] = createSignal<SortKey>("naive");
  const [selectedRank, setSelectedRank] = createSignal(1);
  const [power, setPower] = createSignal(1);

  const example = createMemo(() => props.examples[queryIndex()] ?? props.examples[0]);
  const naiveRanks = createMemo(() => ranksOf(example()?.items ?? [], "naive"));
  const correctedRanks = createMemo(() => ranksOf(example()?.items ?? [], "corrected"));

  /** Grade-0 listings the raw-click model ranks above where the weighted model puts them. */
  const misranked = createMemo(() => {
    const naive = naiveRanks();
    const corrected = correctedRanks();
    return (example()?.items ?? []).filter((item) => {
      const raw = naive.get(item.itemId) ?? 0;
      const weighted = corrected.get(item.itemId) ?? 0;
      return item.grade === 0 && raw < weighted;
    });
  });

  const rows = createMemo(() => {
    const naive = naiveRanks();
    const corrected = correctedRanks();
    return ordered(example()?.items ?? [], sortKey()).map((item, index) => ({
      item,
      rank: index + 1,
      /** Positive when weighting lifts this listing, negative when it drops it. */
      movement: (naive.get(item.itemId) ?? 0) - (corrected.get(item.itemId) ?? 0),
    }));
  });

  const probability = (rank: number) => 1 / rank ** power();
  const weight = (rank: number) =>
    Math.min(1 / Math.max(probability(rank), MIN_PROPENSITY), MAX_IPS);
  const maxWeight = createMemo(() => Math.max(...RANKS.map((rank) => weight(rank)), 1));

  return (
    <div class="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section class="card" aria-label="Same log, two models">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3.5 py-3">
          <div class="flex items-center gap-2.5">
            <h2 class="h2">Same log, two models</h2>
            <span class="tag tag-preview">chapter {props.learnedChapter} lab</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="btn-ghost h-7 px-2.5 text-xs"
              aria-pressed={sortKey() === "naive"}
              onClick={() => setSortKey("naive")}
            >
              Sort by raw clicks
            </button>
            <button
              type="button"
              class="btn-ghost h-7 px-2.5 text-xs"
              aria-pressed={sortKey() === "corrected"}
              onClick={() => setSortKey("corrected")}
            >
              Sort by weighted clicks
            </button>
          </div>
        </div>

        <Show
          when={(props.examples.length ?? 0) > 0}
          fallback={
            <p class="m-0 px-3.5 py-3 text-[13px] text-ink-2">No click-log page was recorded.</p>
          }
        >
          <div class="flex flex-wrap gap-1.5 border-b border-rule-soft px-3.5 py-2.5">
            <For each={props.examples}>
              {(entry, index) => (
                <button
                  type="button"
                  class="btn-ghost h-7 px-2.5 text-xs"
                  aria-pressed={queryIndex() === index()}
                  onClick={() => setQueryIndex(index())}
                >
                  {entry.queryText}
                </button>
              )}
            </For>
          </div>

          <ul class="m-0 list-none p-0">
            <li class="eyebrow hidden grid-cols-[26px_minmax(0,1fr)_60px_56px] gap-2 px-3.5 pb-1 pt-2 sm:grid sm:grid-cols-[34px_minmax(0,1fr)_92px_74px] sm:gap-2.5">
              <span>Rank</span>
              <span>Listing</span>
              <span>Log</span>
              <span class="text-right">Clicks</span>
            </li>
            <For each={rows()}>
              {(row) => (
                <li
                  class="grid grid-cols-[26px_minmax(0,1fr)_60px_56px] items-center gap-2 border-t border-rule-soft px-3.5 py-2 text-[13px] sm:grid-cols-[34px_minmax(0,1fr)_92px_74px] sm:gap-2.5"
                  classList={{
                    "bg-amber-tint":
                      row.item.grade === 0 && misranked().some((m) => m.itemId === row.item.itemId),
                  }}
                >
                  <span class="font-mono text-ink-3">{row.rank}</span>
                  <span class="min-w-0">
                    <span class="font-serif text-[15px]">{titleOf(props, row.item.itemId)}</span>
                    <span class="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span class={row.item.grade > 0 ? "tag tag-ok" : "tag tag-warn"}>
                        grade {row.item.grade}
                      </span>
                      <Show when={row.movement !== 0}>
                        <span class="text-[11.5px] text-ink-3">
                          {row.movement < 0
                            ? `weighting drops it ${Math.abs(row.movement)}`
                            : `weighting lifts it ${row.movement}`}
                        </span>
                      </Show>
                    </span>
                  </span>
                  <span class="font-mono text-[12.5px] text-ink-3">#{row.item.logPosition}</span>
                  <span class="text-right font-mono text-[12.5px] text-ink-3">
                    {row.item.clicks}/{row.item.sessions}
                  </span>
                </li>
              )}
            </For>
          </ul>
          <p class="m-0 border-t border-rule-soft px-3.5 py-2.5 text-[12.5px] text-ink-2">
            <Show
              when={sortKey() === "naive"}
              fallback={
                <>
                  Now sorted by the <strong class="text-ink">weighted</strong> model. A click at
                  position 10 counts for more than one at position 1, so the listings that were only
                  clicked because they sat on top fall down.
                </>
              }
            >
              Sorted by the <strong class="text-ink">raw-click</strong> model.{" "}
              <Show when={misranked().length > 0} fallback="The two models agree on this page.">
                {misranked().length === 1
                  ? "One grade-0 listing ranks higher here than under weighting"
                  : `${misranked().length} grade-0 listings rank higher here than under weighting`}{" "}
                (shaded). Switch the sort to see them drop.
              </Show>
            </Show>
          </p>
        </Show>
      </section>

      <section class="card flex flex-col gap-2 px-[18px] py-4" aria-label="What one click is worth">
        <h2 class="h2">What one click is worth</h2>
        <p class="m-0 text-[12.5px] text-ink-3">
          A click only proves the searcher looked. Divide by how likely that position was to be
          seen, and a click far down the page outweighs one at the top.
        </p>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-[12px] text-ink-3">
            <span>How fast attention fades</span>
            <span class="font-mono">
              {power().toFixed(2)} ·{" "}
              {power() === 1 ? "the simulator's 1/rank" : "a different curve"}
            </span>
          </div>
          <input
            type="range"
            aria-label="How fast attention fades"
            min="0.5"
            max="3"
            step="0.05"
            value={power()}
            onInput={(event) => setPower(Number(event.currentTarget.value))}
          />
        </div>
        <div
          class="flex items-end gap-1.5"
          role="img"
          aria-label="Examination probability and click weight by position"
        >
          <For each={RANKS}>
            {(rank) => (
              <button
                type="button"
                class="group flex flex-1 flex-col items-center gap-1 border-0 bg-transparent p-0"
                aria-pressed={selectedRank() === rank}
                onClick={() => setSelectedRank(rank)}
              >
                <span class="font-mono text-[10.5px] text-ink-3">×{weight(rank).toFixed(1)}</span>
                <span
                  class={
                    selectedRank() === rank
                      ? "w-full rounded-sm bg-amber"
                      : "w-full rounded-sm bg-amber-soft group-hover:bg-amber"
                  }
                  style={{ height: `${(weight(rank) / maxWeight()) * 72 + 2}px` }}
                />
                <span class="font-mono text-[10.5px] text-ink-4">{rank}</span>
              </button>
            )}
          </For>
        </div>
        <p class="m-0 text-[12.5px] text-ink-2">
          Position <strong class="text-ink">{selectedRank()}</strong> is examined with probability{" "}
          <span class="font-mono">{probability(selectedRank()).toFixed(2)}</span>, so one click
          there is worth <span class="font-mono">{weight(selectedRank()).toFixed(1)}</span> clicks
          at the top. The simulator's curve is the 1/rank default; drag to see how a slower or
          faster fade changes the weight. Training caps the weight at 8, so one click never counts
          for more. This slider only moves the bars above; the table on the left always uses the
          log's estimated curve.
        </p>
      </section>
    </div>
  );
}
