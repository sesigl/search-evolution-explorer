import { createSignal, For } from "solid-js";
import type { TowerTrainingReport } from "../../domain/two-tower/training-report.ts";

export default function TowerTrainingEvidence(props: { report: TowerTrainingReport }) {
  const [epoch, setEpoch] = createSignal(props.report.selectedEpoch);
  const point = () =>
    props.report.history.find((row) => row.epoch === epoch()) ?? props.report.history[0];
  function chooseEpoch(value: number) {
    setEpoch(value);
  }
  function changeEpoch(event: { currentTarget: HTMLInputElement }) {
    setEpoch(event.currentTarget.valueAsNumber);
  }
  return (
    <section
      class="rounded-lg border border-rule bg-paper p-4"
      aria-label="Actual training history"
    >
      <h3 class="m-0 font-serif text-lg">Explore the run that produced this model</h3>
      <p class="my-2 text-sm">
        {props.report.trainPairs.toLocaleString()} training pairs ·{" "}
        {props.report.validationPairs.toLocaleString()} validation pairs. Query groups:{" "}
        {props.report.queryCounts.train} train / {props.report.queryCounts.validation} validation /{" "}
        {props.report.queryCounts.test} test.
      </p>
      <fieldset
        class="m-0 flex items-end gap-1 overflow-x-auto border-0 px-0 py-2"
        aria-label="Validation epochs"
      >
        <For each={props.report.history}>
          {(row) => (
            <button
              type="button"
              class="flex min-w-3 flex-1 cursor-pointer flex-col items-center justify-end border-0 bg-transparent p-0"
              aria-pressed={epoch() === row.epoch}
              aria-label={`Epoch ${row.epoch}, validation NDCG ${row.validationNdcgAt10.toFixed(4)}`}
              onClick={[chooseEpoch, row.epoch]}
            >
              <span
                class="block w-full rounded-t-sm"
                classList={{
                  "bg-amber": epoch() === row.epoch,
                  "bg-rule-2": epoch() !== row.epoch,
                }}
                style={{ height: `${row.validationNdcgAt10 * 80}px` }}
              />
              <span class="mt-1 font-mono text-[9px]">{row.epoch}</span>
            </button>
          )}
        </For>
      </fieldset>
      <label class="block text-sm">
        Inspect epoch {epoch()}
        <input
          class="mt-2 block w-full"
          type="range"
          min="0"
          max={props.report.history.length - 1}
          step="1"
          value={epoch()}
          onInput={changeEpoch}
        />
      </label>
      <output class="mt-3 block font-mono text-sm" aria-live="polite">
        Validation retrieval NDCG@10: {point()?.validationNdcgAt10.toFixed(4)}
        <br />
        Validation pair loss: {point()?.validationLoss.toFixed(4)}
        <br />
        Saved model: epoch {props.report.selectedEpoch}
      </output>
      <p class="mb-0 mt-2 text-sm text-ink-2">
        These values come from the loaded artifact, not a drawn example. Move past the saved epoch:
        lower pair loss does not necessarily mean better top-10 retrieval. Selection uses validation
        NDCG, never the test labels.
      </p>
    </section>
  );
}
