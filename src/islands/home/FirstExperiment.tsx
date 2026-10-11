import { createSignal, For, Show } from "solid-js";
import type { ExperimentOutcome } from "../../actions/get-first-experiment.ts";

interface Props {
  query: string;
  corpusSize: number;
  /** Results with the switch off and on, computed on the server so the card works at once. */
  off: ExperimentOutcome;
  on: ExperimentOutcome;
  /** Link that opens the same query on the search page, with the tour. */
  continueHref: string;
}

/**
 * The first page of the book is an experiment, not a paragraph: one real query, one switch,
 * and the result changes under the reader's hand. The two outcomes are precomputed.
 */
export default function FirstExperiment(props: Props) {
  const [synonyms, setSynonyms] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const outcome = () => (synonyms() ? props.on : props.off);

  function toggle() {
    setSynonyms((value) => !value);
    setTouched(true);
  }

  return (
    <section
      class="card-warm flex flex-col gap-3 px-5 py-[18px]"
      aria-label="Your first experiment"
    >
      <div class="flex items-baseline justify-between gap-3">
        <span class="eyebrow tracking-[0.06em]">Your first experiment · 20 seconds</span>
        <span class="text-[11.5px] text-ink-4">sample data, {props.corpusSize} listings</span>
      </div>
      <p class="m-0 font-serif text-[16px] leading-snug">
        A buyer types <strong>“{props.query}”</strong>. The sellers wrote “rug”. The simplest search
        looks for the exact word.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <label
          class="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-rule-2 bg-surface py-1.5 pl-2 pr-3 text-[13px] font-medium"
          classList={{ "text-ink": synonyms(), "text-ink-4": !synonyms() }}
        >
          <input
            type="checkbox"
            checked={synonyms()}
            onChange={toggle}
            class="peer sr-only"
            data-experiment-switch={true}
          />
          <span
            aria-hidden="true"
            class="relative h-[18px] w-[30px] rounded-full transition-colors after:absolute after:top-0.5 after:h-[14px] after:w-[14px] after:rounded-full after:bg-surface after:transition-[left] after:duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber"
            classList={{
              "bg-blue after:left-[14px]": synonyms(),
              "bg-rule-2 after:left-0.5": !synonyms(),
            }}
          />
          Synonyms {synonyms() ? "on" : "off"}
        </label>
        <Show when={!touched()}>
          <span class="text-[12.5px] text-amber-deep">← Flip the switch</span>
        </Show>
      </div>

      <div
        class="rounded-lg border border-rule bg-surface px-3.5 py-3 transition-colors"
        classList={{ "border-red-soft": outcome().matched === 0 }}
        aria-live="polite"
      >
        <div class="flex items-baseline gap-2 text-[12.5px] text-ink-2">
          <strong class="font-mono text-[15px] text-ink">{outcome().matched}</strong>
          <span>of {props.corpusSize} listings matched</span>
        </div>
        <Show
          when={outcome().titles.length > 0}
          fallback={
            <p class="m-0 mt-1.5 font-serif text-[14.5px] text-red">
              Nothing found. No listing contains the word “{props.query}”.
            </p>
          }
        >
          <ol class="m-0 mt-1.5 list-none p-0 font-serif text-[14.5px]">
            <For each={outcome().titles}>
              {(title, position) => (
                <li class="flex gap-2 py-0.5">
                  <span class="w-4 font-mono text-xs text-ink-4">{position() + 1}</span>
                  <span>{title}</span>
                </li>
              )}
            </For>
            <Show when={outcome().matched > outcome().titles.length}>
              <li class="pl-6 text-[12.5px] text-ink-4">
                and {outcome().matched - outcome().titles.length} more
              </li>
            </Show>
          </ol>
        </Show>
      </div>

      <p class="m-0 text-[13px] leading-snug text-ink-2">
        <Show
          when={synonyms()}
          fallback={
            <>
              This is the first weakness of the simplest search: the buyer and the seller do not use
              the same word.
            </>
          }
        >
          <strong class="text-ink">That is the fix.</strong> This card runs chapter 2 with one
          switch toggled. Synonym expansion adds “rug” to “{props.query}”, so one switch turns{" "}
          {props.off.matched} matches into {props.on.matched}: rugs appear that the exact search
          missed. Start simple, see where it breaks, fix it, learn its name: every chapter of this
          book works this way.
        </Show>
      </p>
      <Show when={touched()}>
        <a class="btn self-start" href={props.continueHref}>
          Take the two-minute tour
          <span aria-hidden="true">→</span>
        </a>
      </Show>
    </section>
  );
}
