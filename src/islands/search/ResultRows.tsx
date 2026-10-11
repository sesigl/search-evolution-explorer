import { createEffect, createSignal, For, on, onMount, Show } from "solid-js";
import type { WorkbenchResult, WorkbenchSignal } from "../../actions/search-workbench.ts";
import {
  ageLabel,
  jointRerankingFor,
  priceLabel,
  scoreText,
  signalInfo,
  weightSourceFor,
} from "./format.ts";

/** Signals that decide which listings are candidates paint blue; everything that orders them paints amber. */
const MATCHING_SIGNALS = new Set(["bm25", "vectorSimilarity"]);

/** The user asked for less motion; skip the row FLIP animation. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  results: readonly WorkbenchResult[];
  scoreLabel: string;
  /** Plain sentence on what the score means; shown as the badge tooltip. */
  scoreMeaning?: string;
  /** Level id, so a weighted score can explain where its weights come from. */
  levelId?: string | undefined;
  /** Rows are animated to their new position when the same listing moves between two renders. */
  animate?: boolean;
}

export default function ResultRows(props: Props) {
  const [open, setOpen] = createSignal<ReadonlySet<string>>(
    new Set(props.results[0] === undefined ? [] : [props.results[0].id]),
  );
  const [nowMs, setNowMs] = createSignal(Date.now());
  onMount(() => setNowMs(Date.now()));

  const rows = new Map<string, HTMLLIElement>();
  let previousRects = new Map<string, DOMRect>();

  function toggle(id: string) {
    const next = new Set(open());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setOpen(next);
  }

  function snapshot() {
    previousRects = new Map();
    for (const [id, element] of rows) {
      previousRects.set(id, element.getBoundingClientRect());
    }
  }

  // FLIP: measure the rows before the list changes, then animate the difference.
  createEffect(
    on(
      () => props.results,
      () => {
        if (!props.animate || prefersReducedMotion() || previousRects.size === 0) {
          snapshot();
          return;
        }
        requestAnimationFrame(() => {
          for (const [id, element] of rows) {
            const before = previousRects.get(id);
            const after = element.getBoundingClientRect();
            if (before === undefined) {
              element.animate(
                [
                  { opacity: 0, transform: "translateY(8px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
              );
              continue;
            }
            const dy = before.top - after.top;
            if (Math.abs(dy) > 1) {
              element.animate(
                [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
                { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" },
              );
            }
          }
          snapshot();
        });
      },
      { defer: true },
    ),
  );
  onMount(snapshot);

  const maxBySignal = () => {
    const max = new Map<string, number>();
    for (const result of props.results) {
      for (const signal of result.signals) {
        max.set(signal.name, Math.max(max.get(signal.name) ?? 0, Math.abs(signal.value)));
      }
    }
    return max;
  };

  return (
    <ol class="m-0 list-none p-0">
      <For each={props.results}>
        {(result) => (
          <li
            class="border-t border-rule-soft first:border-t-0"
            ref={(element) => {
              rows.set(result.id, element);
            }}
          >
            <button
              type="button"
              aria-expanded={open().has(result.id)}
              onClick={() => toggle(result.id)}
              class="grid w-full cursor-pointer grid-cols-[36px_1fr_auto] items-start gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left font-sans hover:bg-[#fcf9f2]"
            >
              <span class="pt-0.5 font-mono text-[13px] text-ink-4">{result.position}</span>
              <span class="min-w-0">
                <span class="block font-serif text-[19px] font-medium leading-[1.25] text-ink">
                  {result.title}
                </span>
                <Show
                  when={result.signals.some((signal) => signal.name === "learnedRetrievalOnly")}
                >
                  <span class="mt-1 inline-block rounded-sm bg-blue-soft px-1.5 py-0.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.04em] text-blue-deep">
                    New candidate
                  </span>
                </Show>
                <Show when={result.description !== ""}>
                  <span class="mt-0.5 block truncate text-[13px] leading-snug text-ink-2">
                    {result.description}
                  </span>
                </Show>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-ink-3">
                  <span>{result.categoryId}</span>
                  <span class="text-rule-2">·</span>
                  <span class="whitespace-nowrap font-mono">{priceLabel(result.priceCents)}</span>
                  <Show when={result.location !== ""}>
                    <span class="text-rule-2">·</span>
                    <span>{result.location}</span>
                  </Show>
                  <span class="text-rule-2">·</span>
                  <span class="whitespace-nowrap">{ageLabel(result.postedAt, nowMs())}</span>
                </span>
              </span>
              <span class="text-right">
                <span class="term block text-[10.5px] uppercase tracking-[0.05em] text-ink-4">
                  <span class="term-word decoration-ink-5" tabindex="0">
                    {props.scoreLabel}
                  </span>
                  <Show when={props.scoreMeaning}>
                    {(meaning) => (
                      <span role="tooltip" class="right-0 left-auto text-left">
                        {meaning()}
                      </span>
                    )}
                  </Show>
                </span>
                <span class="block font-mono text-[15px] text-ink">{scoreText(result.score)}</span>
              </span>
            </button>
            <Show when={open().has(result.id) && result.signals.length > 0}>
              <div class="pb-3.5 pl-[66px] pr-4">
                <SignalBars
                  signals={result.signals}
                  maxBySignal={maxBySignal()}
                  levelId={props.levelId}
                  score={result.score}
                />
              </div>
            </Show>
          </li>
        )}
      </For>
    </ol>
  );
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }
  return value.toFixed(3);
}

function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(2);
}

function SignalBars(props: {
  signals: readonly WorkbenchSignal[];
  maxBySignal: ReadonlyMap<string, number>;
  levelId?: string | undefined;
  score: number;
}) {
  function width(signal: WorkbenchSignal): string {
    const max = props.maxBySignal.get(signal.name) ?? Math.abs(signal.value);
    if (max === 0) {
      return "0%";
    }
    return `${Math.max(3, Math.round((Math.abs(signal.value) / max) * 100))}%`;
  }
  const weighted = () => props.signals.filter((signal) => signal.weight !== undefined);
  const jointReranking = () => jointRerankingFor(props.levelId);
  const weightSource = () => weightSourceFor(props.levelId);
  // Sum the full-precision products, so the printed total matches the score shown in the row.
  const builtTotal = () =>
    weighted().reduce((sum, signal) => sum + (signal.weight ?? 0) * signal.value, 0);
  return (
    <ul class="m-0 flex list-none flex-col gap-2 rounded-lg bg-paper px-3.5 py-3">
      <li class="flex gap-3 text-[11px] text-ink-4">
        <span class="inline-flex items-center gap-1.5">
          <i
            class="inline-block h-2 w-2 rounded-sm"
            classList={{ "bg-rule-2": jointReranking(), "bg-blue": !jointReranking() }}
            aria-hidden="true"
          />
          {jointReranking() ? "retrieval signals (context)" : "decides which listings match"}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <i class="inline-block h-2 w-2 rounded-sm bg-amber" aria-hidden="true" />
          decides the order
        </span>
      </li>
      <For each={props.signals}>
        {(signal) => (
          <li class="grid grid-cols-[104px_1fr_64px] items-center sm:grid-cols-[150px_1fr_72px] gap-x-2.5 gap-y-0.5 text-xs">
            <span class="min-w-0">
              <span class="block truncate font-medium text-ink">
                {signalInfo(signal.name).label}
              </span>
              <Show when={signal.weight !== undefined}>
                <span class="block truncate font-mono text-[10.5px] text-amber-deep">
                  weight {formatWeight(signal.weight ?? 0)}
                </span>
              </Show>
            </span>
            <span class="h-1.5 overflow-hidden rounded-[3px] bg-paper-2" aria-hidden="true">
              <span
                class="block h-full rounded-[3px] transition-[width] duration-500 ease-out"
                classList={{
                  "bg-blue": !jointReranking() && MATCHING_SIGNALS.has(signal.name),
                  "bg-amber": jointReranking()
                    ? signal.name === "crossEncoder" || signal.weight !== undefined
                    : !MATCHING_SIGNALS.has(signal.name),
                  "bg-rule-2":
                    jointReranking() &&
                    signal.name !== "crossEncoder" &&
                    signal.weight === undefined,
                }}
                style={{ width: width(signal) }}
              />
            </span>
            <span class="text-right font-mono text-ink">{formatValue(signal.value)}</span>
            <span class="col-span-3 text-[11.5px] text-ink-3">
              {signalInfo(signal.name).meaning}
            </span>
          </li>
        )}
      </For>
      <Show when={weighted().length > 0}>
        <li class="mt-1 rounded-md border border-rule-soft bg-surface px-3 py-2">
          <span class="eyebrow block">How this score was built</span>
          <p class="m-0 mt-1 break-words font-mono text-[12px] leading-relaxed text-ink-2">
            <For each={weighted()}>
              {(signal, index) => (
                <>
                  {index() > 0 ? " + " : ""}
                  {signalInfo(signal.name).label} {formatValue(signal.value)}×
                  {formatWeight(signal.weight ?? 0)}
                </>
              )}
            </For>
            {" = "}
            <strong class="text-ink">{formatValue(builtTotal())}</strong>
          </p>
          <Show when={weightSource()}>
            {(source) => <span class="mt-1 block text-[11.5px] text-ink-3">{source()}</span>}
          </Show>
        </li>
      </Show>
    </ul>
  );
}
