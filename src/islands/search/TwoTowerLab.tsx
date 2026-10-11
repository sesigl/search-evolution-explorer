import { createSignal, For, onMount, Show } from "solid-js";
import trainerSource from "../../../scripts/train-two-tower.py?raw";
import type { WorkbenchState } from "../../actions/search-workbench.ts";
import type { LessonTry } from "../../content/lessons.ts";
import type { TowerTrainingReport } from "../../domain/two-tower/training-report.ts";
import type { Scorecard } from "../../domain/types/evaluation.ts";
import { signalInfo } from "./format.ts";
import TowerTrainingEvidence from "./TowerTrainingEvidence.tsx";

const STAGES = ["Find", "Train", "Inspect", "Evaluate", "Operate"];
const EXAMPLES = ["area rug", "mid century modern", "turquoise pillows"];
const ALL_ON = { stemming: true, synonyms: true, variants: true };
const TOWER_FORMULA = [
  "x = normalize(0.8 E(title) + 0.2 E(title + description))",
  "q = normalize(Wq × E(query))",
  "v = normalize(Wi × x)",
  "similarity = sum(q[j] × v[j])",
].join("\n");
const REBUILD_COMMANDS = [
  "python3 -m pip install -r scripts/requirements-two-tower.txt",
  "npm run data:two-tower",
  "# Restart the app after rebuilding",
  "npm run evaluate",
].join("\n");

export default function TwoTowerLab(props: {
  anchorId: string;
  state: WorkbenchState;
  onTry: (attempt: LessonTry, event: MouseEvent) => void;
  /** Ordinal of the two-tower chapter itself; the chapter below is one less. */
  levelOrdinal: number;
}) {
  const [stage, setStage] = createSignal(0);
  const [positive, setPositive] = createSignal(0.5);
  const [negative, setNegative] = createSignal(0.3);
  const [temperature, setTemperature] = createSignal(0.1);
  const [scorecard, setScorecard] = createSignal<Scorecard | null>(null);
  const [status, setStatus] = createSignal("");
  const [heldOut, setHeldOut] = createSignal(false);
  const [selectedId, setSelectedId] = createSignal("");
  const [training, setTraining] = createSignal<TowerTrainingReport | null>(null);
  onMount(() => {
    void fetch("/api/two-tower.json")
      .then(async (response) => {
        if (response.ok) setTraining(await response.json());
      })
      .catch(() => setTraining(null));
  });
  const selected = () =>
    props.state.view?.results.find((row) => row.id === selectedId()) ??
    props.state.view?.results[0];
  const onTwoTower = () => props.state.selected?.id === "level-6-two-tower";
  const belowOrdinal = () => Math.max(1, props.levelOrdinal - 1);
  const margin = () => (positive() - negative()) / temperature();
  const loss = () => Math.max(0, -margin()) + Math.log1p(Math.exp(-Math.abs(margin())));
  const runs = () =>
    (heldOut() ? scorecard()?.heldOut : scorecard())?.runs.filter((measurement) =>
      ["level-5-cross-encoder", "level-6-two-tower"].includes(measurement.levelId),
    ) ?? [];

  function run(event: MouseEvent, query: string, levelId: string) {
    props.onTry({ label: query, query, levelId, levers: ALL_ON }, event);
  }
  function chooseStage(index: number) {
    setStage(index);
  }
  function chooseQuery(query: string, event: MouseEvent) {
    run(event, query, "level-6-two-tower");
  }
  function before(event: MouseEvent) {
    run(event, props.state.query || "area rug", "level-5-cross-encoder");
  }
  function after(event: MouseEvent) {
    run(event, props.state.query || "area rug", "level-6-two-tower");
  }
  function updatePositive(event: { currentTarget: HTMLInputElement }) {
    setPositive(event.currentTarget.valueAsNumber);
  }
  function updateNegative(event: { currentTarget: HTMLInputElement }) {
    setNegative(event.currentTarget.valueAsNumber);
  }
  function updateTemperature(event: { currentTarget: HTMLInputElement }) {
    setTemperature(event.currentTarget.valueAsNumber);
  }
  function chooseResult(event: { currentTarget: HTMLSelectElement }) {
    setSelectedId(event.currentTarget.value);
  }
  function chooseSplit(event: { currentTarget: HTMLInputElement }) {
    setHeldOut(event.currentTarget.checked);
  }
  function inspectRegression(query: string, event: MouseEvent) {
    run(event, query, "level-6-two-tower");
    setStage(2);
  }
  async function evaluate() {
    setStatus(
      "Running the real scorecard. The first run includes local neural inference and can take several minutes.",
    );
    try {
      const response = await fetch("/api/scorecard.json");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setScorecard(await response.json());
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evaluation failed.");
    }
  }
  return (
    <section
      id={props.anchorId}
      class="card overflow-hidden"
      aria-label="Interactive two-tower lesson"
    >
      <header class="border-b border-rule px-5 py-4">
        <span class="eyebrow">
          {onTwoTower()
            ? `Chapter ${props.levelOrdinal} · Go deeper — optional`
            : `Chapter ${props.levelOrdinal} · comparing against chapter ${belowOrdinal()}`}
        </span>
        <h2 class="m-0 mt-1 font-serif text-2xl">
          {onTwoTower()
            ? "Find what the reranker never saw"
            : `The candidates chapter ${belowOrdinal()} reranked`}
        </h2>
        <p class="m-0 mt-2 font-mono text-xs text-ink-3">
          Showing Chapter {props.state.selected?.ordinal ?? props.levelOrdinal}:{" "}
          {props.state.query || "choose a query"}
        </p>
        <p class="m-0 mt-2 text-sm text-ink-2">
          The four-step lesson is the chapter. This panel is optional: it keeps the same five stages
          — run a query, change a training example, inspect the actual signals, then check quality.
        </p>
      </header>
      <Show when={!onTwoTower()}>
        <div
          role="status"
          class="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-amber-tint px-5 py-3 text-sm"
        >
          <span>
            You are viewing{" "}
            <strong>Chapter {props.state.selected?.ordinal ?? belowOrdinal()}</strong>'s list. The
            workspace stays open so you can compare. Return to Chapter {props.levelOrdinal} to find
            a new candidate.
          </span>
          <button type="button" class="btn-ghost border border-rule px-3 py-1.5" onClick={after}>
            Back to: Chapter {props.levelOrdinal}
          </button>
        </div>
      </Show>
      <nav
        class="flex flex-wrap gap-2 border-b border-rule bg-paper px-4 py-3"
        aria-label="Learning stages"
      >
        <For each={STAGES}>
          {(label, index) => (
            <button
              type="button"
              class="btn-ghost px-3 py-2"
              classList={{ "bg-amber-soft font-semibold": stage() === index() }}
              aria-pressed={stage() === index()}
              onClick={[chooseStage, index()]}
            >
              {index() + 1}. {label}
            </button>
          )}
        </For>
      </nav>
      <div class="space-y-4 px-5 py-5 text-[15px] leading-relaxed">
        <Show when={stage() === 0}>
          <p class="m-0">
            Chapter 10 can only reorder its 50 candidates. A trained retrieval branch can find a
            listing outside them. Start with a real query, then switch between the two engines.
          </p>
          <div class="flex flex-wrap gap-2">
            <For each={EXAMPLES}>
              {(query) => (
                <button
                  type="button"
                  class="chip cursor-pointer border border-rule bg-paper px-3 py-2"
                  onClick={[chooseQuery, query]}
                >
                  {query}
                </button>
              )}
            </For>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" class="btn-ghost border border-rule px-4 py-2" onClick={before}>
              Before: Chapter 10
            </button>
            <button type="button" class="btn-ghost border border-rule px-4 py-2" onClick={after}>
              After: Chapter 11
            </button>
          </div>
          <Show
            when={onTwoTower()}
            fallback={
              <aside class="rounded-lg bg-paper p-3 text-sm">
                The list below shows Chapter 10. Press <strong>Back to: Chapter 11</strong> to see
                which listings the trained branch adds.
              </aside>
            }
          >
            <aside class="rounded-lg bg-amber-tint p-3 text-sm">
              <strong>Your task:</strong> find a result with <strong>New candidate</strong> in its
              signals. Rows the trained branch added carry that marker next to the title, so you can
              spot them without opening every row. That is retrieval changing the set. Inspect how
              joint relevance and weighted learned similarity determine its final position.
            </aside>
          </Show>
          <details>
            <summary class="cursor-pointer font-semibold">
              Why add a branch rather than score the whole inventory?
            </summary>
            <p>
              Joint attention reads the query and listing together, so it must run for every pair.
              Two independent towers let us precompute the item side. A cheap vector search finds a
              shortlist for the expensive model. The generic and lexical branch still covers exact
              names and queries absent from training.
            </p>
          </details>
        </Show>
        <Show when={stage() === 1}>
          <h3 class="m-0 font-serif text-lg">Make the higher-grade listing win</h3>
          <p class="m-0">
            This is a mathematical sandbox, not a change to the deployed model. Move the scores and
            temperature. The trainer uses this same pairwise logistic loss.
          </p>
          <aside class="rounded-lg bg-paper p-3 text-sm">
            <strong>The math you need (30 seconds).</strong> A vector is a list of numbers. A dot
            product multiplies two vectors element by element and adds the results; larger means
            closer. A matrix is a table of learnable weights that turns one vector into another. A
            gradient points uphill; training steps the other way to lower the loss. That is enough
            to read this stage.
          </aside>
          <label class="block">
            Higher-grade similarity <strong class="font-mono">{positive().toFixed(2)}</strong>
            <input
              class="mt-2 block w-full accent-amber"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={positive()}
              onInput={updatePositive}
            />
          </label>
          <label class="block">
            Lower-grade similarity <strong class="font-mono">{negative().toFixed(2)}</strong>
            <input
              class="mt-2 block w-full accent-amber"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={negative()}
              onInput={updateNegative}
            />
          </label>
          <label class="block">
            Temperature τ <strong class="font-mono">{temperature().toFixed(2)}</strong>
            <input
              class="mt-2 block w-full accent-amber"
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={temperature()}
              onInput={updateTemperature}
            />
          </label>
          <output class="block rounded-lg bg-paper p-4 font-mono text-sm" aria-live="polite">
            margin = (higher-grade − lower-grade) / τ = {margin().toFixed(3)}
            <br />
            loss = log(1 + exp(−margin)) = {loss().toFixed(4)}
          </output>
          <p class="m-0 text-sm text-ink-2">
            Equal scores produce log(2) ≈ 0.693. Reversing a good pair increases the loss. The
            gradient updates both heads; the frozen transformer stays fixed.
          </p>
          <Show when={training()}>{(report) => <TowerTrainingEvidence report={report()} />}</Show>
          <details>
            <summary class="cursor-pointer font-semibold">What exactly are the two towers?</summary>
            <p>
              Each tower takes a frozen 384-dimensional MiniLM text embedding. A separately trained
              96×384 matrix maps it to 96 dimensions. Divide by Euclidean length to get a unit
              vector. Retrieval uses qᵀv. An inventory-only SVD supplies the initial shared
              projection. The heads then receive separate gradients, with a penalty for moving too
              far from that starting map. Item embeddings emphasize titles because many descriptions
              in this inventory are off topic.
            </p>
            <pre class="overflow-auto rounded bg-paper p-3 text-xs">{TOWER_FORMULA}</pre>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              Where do the examples and their weights come from?
            </summary>
            <p>
              We split normalized query texts before reading their labels for training. Within
              training queries, a higher relevance grade is preferred to a lower grade. Pair weights
              are their gain difference: (2^higher − 2^lower) / 7. At most 256 seeded pairs per
              query limit domination by large groups. A non-click is not used as a negative label.
            </p>
            <p>
              Training labels come only from training query groups. Validation NDCG chooses the
              epoch, retrieval budget and a global score-fusion weight. Test-query labels are
              excluded from both steps. The overall scorecard includes train and validation queries,
              so inspect the separate test view too. Related paraphrases can cross this split; these
              are offline relevance outcomes, not production engagement.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              Why did the click-trained attempt fail?
            </summary>
            <p>
              In the first sampler, 98.6% of its negative listings were clicked in another session
              for that query. Only nine validation queries supplied pairs. More importantly, the
              click simulator omits exactness distinctions in the relevance grades. Optimizing that
              click loss was optimizing a different target. This implementation uses explicit graded
              preferences, preserving separate test query groups.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              Read the actual training script here
            </summary>
            <pre class="max-h-[400px] overflow-auto rounded bg-paper p-3 text-[11px] leading-relaxed">
              <code>{trainerSource}</code>
            </pre>
          </details>
        </Show>
        <Show when={stage() === 2}>
          <h3 class="m-0 font-serif text-lg">Inspect a result from the current search</h3>
          <Show when={props.state.view} fallback={<p>Run a query in “Find” first.</p>}>
            <label class="block text-sm">
              Listing
              <select
                class="mt-2 block w-full rounded border border-rule bg-surface p-2"
                value={selected()?.id ?? ""}
                onChange={chooseResult}
              >
                <For each={props.state.view?.results ?? []}>
                  {(row) => (
                    <option value={row.id}>
                      {row.position}. {row.title}
                    </option>
                  )}
                </For>
              </select>
            </label>
            <Show when={selected()}>
              {(row) => (
                <div class="rounded-lg border border-rule p-3">
                  <strong>{row().title}</strong>
                  <p class="m-0 mt-1 font-mono text-sm">Final score: {row().score.toFixed(4)}</p>
                  <dl class="m-0 mt-3 space-y-3">
                    <For each={row().signals}>
                      {(signal) => (
                        <div>
                          <dt class="flex justify-between gap-4 font-semibold">
                            {signalInfo(signal.name).label}
                            <span class="font-mono">{signal.value.toFixed(4)}</span>
                          </dt>
                          <dd class="m-0 text-sm text-ink-2">
                            {signalInfo(signal.name).meaning || signal.explanation}
                          </dd>
                        </div>
                      )}
                    </For>
                  </dl>
                </div>
              )}
            </Show>
          </Show>
          <details>
            <summary class="cursor-pointer font-semibold">Trace the serving steps</summary>
            <ol class="space-y-2 pl-5">
              <li>Encode query text with the same normalization used in training.</li>
              <li>Apply the learned query matrix. Item vectors are already indexed.</li>
              <li>
                Find neighbours by exact dot product. Resolve IDs against available inventory.
              </li>
              <li>Combine with Chapter 10's candidate scores. Deduplicate by item ID.</li>
              <li>Run the same cross-encoder on new candidates only.</li>
              <li>
                Add trained similarity with the validation-selected global weight. Sort before
                paging.
              </li>
            </ol>
            <p>
              Raw retrieval and joint scores have different scales. Validation selects their
              relative weight; the interface shows both weighted terms and their exact sum. Old
              candidates can move even when their own joint score is unchanged.
            </p>
            <a href="/level/level-6-two-tower">Open annotated serving code →</a>
          </details>
        </Show>
        <Show when={stage() === 3}>
          <h3 class="m-0 font-serif text-lg">Does the change improve search?</h3>
          <Show when={training()}>
            {(report) => (
              <details>
                <summary class="cursor-pointer font-semibold">
                  Inspect the validation experiments that selected the policy
                </summary>
                <p class="text-sm">
                  These are measured validation results. “hybrid-100” and “generic-title-100” are
                  larger-budget controls, not trained towers. The selected policy can use fewer
                  candidates. None of these rows uses test labels.
                </p>
                <div class="max-h-64 overflow-auto">
                  <table class="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th class="p-2">Policy</th>
                        <th class="p-2">Weight</th>
                        <th class="p-2">New-branch limit</th>
                        <th class="p-2">NDCG@10</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={report().calibration}>
                        {(row) => (
                          <tr class="border-t border-rule">
                            <th class="p-2">{row.name}</th>
                            <td class="p-2">{row.scoreWeight}</td>
                            <td class="p-2">
                              {row.name === "trained" || row.name === "generic-title-100"
                                ? row.retrievalLimit
                                : "—"}
                            </td>
                            <td class="p-2 font-mono">{row.ndcgAt10.toFixed(4)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </Show>
          <button type="button" class="btn-ghost border border-rule px-3 py-2" onClick={evaluate}>
            Load measured scorecard
          </button>
          <Show when={status()}>
            <p class="m-0 text-sm" role="status">
              {status()}
            </p>
          </Show>
          <Show when={scorecard()}>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={heldOut()} onChange={chooseSplit} />
              Use only Chapter 11's held-out query texts
            </label>
            <p class="m-0 text-xs text-ink-3">
              This switches the summary table below to the 32 test queries. The validation grid
              above never uses test labels.
            </p>
            <div class="overflow-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th class="p-2">Chapter</th>
                    <th class="p-2">Queries</th>
                    <th class="p-2">NDCG@10</th>
                    <th class="p-2">MRR</th>
                    <th class="p-2">Recall@50</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={runs()}>
                    {(row) => (
                      <tr class="border-t border-rule">
                        <th class="p-2">
                          {row.levelId === "level-5-cross-encoder"
                            ? belowOrdinal()
                            : props.levelOrdinal}
                        </th>
                        <td class="p-2">{row.perQuery.length}</td>
                        <td class="p-2 font-mono">{row.ndcgAt10.toFixed(4)}</td>
                        <td class="p-2 font-mono">{row.mrr.toFixed(4)}</td>
                        <td class="p-2 font-mono">{row.recallAt50.toFixed(4)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <details>
              <summary class="cursor-pointer font-semibold">Explore query regressions</summary>
              <div class="mt-3 flex max-h-48 flex-wrap gap-2 overflow-auto">
                <For
                  each={
                    (heldOut() ? scorecard()?.heldOut : scorecard())?.regressions.filter(
                      (row) => row.levelId === "level-6-two-tower",
                    ) ?? []
                  }
                >
                  {(row) => (
                    <button
                      type="button"
                      class="chip border border-rule px-2 py-1"
                      onClick={[inspectRegression, row.queryText]}
                    >
                      {row.queryText} ({row.delta.toFixed(3)})
                    </button>
                  )}
                </For>
              </div>
            </details>
          </Show>
          <details>
            <summary class="cursor-pointer font-semibold">
              Interpret the experiment correctly
            </summary>
            <p>
              NDCG@10 measures first-page ordering. MRR measures the first relevant hit. Recall@50
              measures known relevant items in the final 50, not the whole union. A larger union can
              still lower all three if poor new candidates displace useful listings.
            </p>
            <p>
              The overall view includes training and validation queries. The test split excludes
              them for the new heads, but Chapter 8's inherited ranker was trained on the full
              simulated log. Independent future data and real contacts or replies are needed before
              a production claim. A larger candidate budget can itself improve recall; compare
              equal-budget generic retrieval before attributing a gain to training.
            </p>
          </details>
        </Show>
        <Show when={stage() === 4}>
          <h3 class="m-0 font-serif text-lg">Predict what breaks in production</h3>
          <details>
            <summary class="cursor-pointer font-semibold">
              You update the item head but keep the old index. What happens?
            </summary>
            <p>
              The query and item coordinates no longer belong to a compatible space. Deploy the
              trained query head, item head and rebuilt vectors as one version. Validate hashes,
              dimensions, unit lengths and Python/TypeScript parity. Rollback must restore the
              complete bundle.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              A new listing has no clicks. Can it be retrieved?
            </summary>
            <p>
              Yes. Its features are title and description, not an item ID. Compute its frozen text
              embedding and item projection, then add that vector. The lexical branch can serve it
              first. Deletions need a serving availability check and index cleanup.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              Inventory grows from about 43,000 listings to one million. What changes?
            </summary>
            <p>
              A 96-dimensional float32 vector needs 384 bytes. One million need 384 MB before IDs
              and ANN overhead. Exact retrieval computes N×96 products and sorts all hits. Use an
              ANN index such as HNSW only when measured latency requires it. Compare approximate
              neighbour recall with exact search separately from relevance Recall@50. This app
              implements exact search.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">
              Would adding user history make this a user tower?
            </summary>
            <p>
              A user/query tower can encode recent session interests with explicit query text. It
              needs leakage-safe event timestamps and training data for the intended objective. The
              current model has no personal history features and predicts a relative retrieval
              score, not a measured probability of engagement.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">Rebuild and reproduce</summary>
            <pre class="overflow-auto rounded bg-paper p-3 text-xs">{REBUILD_COMMANDS}</pre>
            <p class="text-sm">
              The manifest records the seed, input hashes, split membership, pair counts and
              validation history. The app disables stale artifacts instead of displaying an
              untrained fallback.
            </p>
          </details>
          <details>
            <summary class="cursor-pointer font-semibold">Read the primary sources</summary>
            <ul class="space-y-2 pl-5">
              <li>
                <a href="https://research.google/pubs/sampling-bias-corrected-neural-modeling-for-large-corpus-item-recommendations/">
                  Yi et al.: sampling-bias-corrected two-tower retrieval
                </a>
              </li>
              <li>
                <a href="https://arxiv.org/abs/1608.04468">
                  Joachims et al.: learning from biased feedback
                </a>
              </li>
              <li>
                <a href="https://arxiv.org/abs/1603.09320">
                  Malkov and Yashunin: HNSW approximate search
                </a>
              </li>
            </ul>
          </details>
        </Show>
      </div>
    </section>
  );
}
