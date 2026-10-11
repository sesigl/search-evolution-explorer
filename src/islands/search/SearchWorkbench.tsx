import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type {
  WorkbenchLevers,
  WorkbenchState,
  WorkbenchUnderstanding,
} from "../../actions/search-workbench.ts";
import { type LessonTry, lessonFor } from "../../content/lessons.ts";
import type { TourRun } from "../../content/tours.ts";
import type { LevelListItem } from "../../domain/levels/list-levels.ts";
import { markVisited, rememberPlace } from "../shared/storage.ts";
import { TOUR_RUN_EVENT } from "../tour/Tour.tsx";
import Checkpoint, { gradeHref } from "./Checkpoint.tsx";
import EvaluationLab, { GRADE_EVENT, type GradeRequest } from "./EvaluationLab.tsx";
import { scoreLabelFor, scoreMeaningFor, searchHref, workbenchQuery } from "./format.ts";
import LessonCard from "./Lesson.tsx";
import ResultRows from "./ResultRows.tsx";
import Terms from "./Terms.tsx";
import TwoTowerLab from "./TwoTowerLab.tsx";

interface Props {
  levels: readonly LevelListItem[];
  initial: WorkbenchState;
  /** Judged queries the introduction's lab can grade. */
  teachingQueries: readonly string[];
  /** Chapter the introduction's lab grades first, from the `grade` URL parameter. */
  gradeLevelId: string | null;
}

/**
 * The workbench state encoded in the address bar. Mirrors the server's parser so a browser
 * Back or Forward step restores the same query, level and levers the URL names.
 */
function requestFromUrl(): {
  query: string;
  levelId: string;
  levers: WorkbenchLevers;
  page: number;
} {
  const params = new URLSearchParams(window.location.search);
  const explicit =
    params.has("levers") ||
    params.has("stemming") ||
    params.has("synonyms") ||
    params.has("variants");
  const page = Number(params.get("page") ?? "1");
  return {
    query: (params.get("q") ?? "").trim(),
    levelId: params.get("level") ?? "level-1-recency",
    levers: {
      stemming: explicit ? params.has("stemming") : true,
      synonyms: explicit ? params.has("synonyms") : true,
      variants: explicit ? params.has("variants") : true,
    },
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Keep the top-bar "Code" link on the chapter the reader is actually running. */
function syncCodeLink(levelId: string): void {
  const link = document.getElementById("nav-code");
  if (link instanceof HTMLAnchorElement && levelId !== "level-0-evaluation") {
    link.href = `/level/${levelId}`;
  }
}

interface LeverInfo {
  readonly name: keyof WorkbenchLevers;
  readonly label: string;
  /** A query where this lever visibly changes the result. */
  readonly demoQuery: string;
  readonly effect: string;
}

const LEVERS: readonly LeverInfo[] = [
  {
    name: "stemming",
    label: "Stemming",
    demoQuery: "bikes",
    effect: "'bikes' becomes 'bike' and matches",
  },
  {
    name: "synonyms",
    label: "Synonyms",
    demoQuery: "couch",
    effect: "'couch' also finds 'sofa'",
  },
  {
    name: "variants",
    label: "Spelling variants",
    demoQuery: "mid century",
    effect: "'mid century' also finds 'midcentury'",
  },
];

const ALL_ON: WorkbenchLevers = { stemming: true, synonyms: true, variants: true };

function leverNoteText(
  lever: LeverInfo,
  turnedOn: boolean,
  query: string,
  unchanged: boolean,
  strictChapter: boolean,
): string {
  const setting = turnedOn ? "on" : "off";
  if (strictChapter) {
    return `Chapter 1 matches words exactly as typed: there are no switches yet, so the list stays the same. Switch to chapter 2 and “${query}” can use them.`;
  }
  if (unchanged) {
    return `Switching ${lever.label.toLowerCase()} ${setting} changed nothing for “${query}”: this query has no word the switch can change. It matters for “${lever.demoQuery}” (${lever.effect}).`;
  }
  const consequence = turnedOn
    ? "More listings match now; check whether every new one is what a searcher wanted."
    : "Fewer listings match now; the ones that left needed this switch.";
  return `${lever.label} ${setting}: the candidate set changed, so the list changed. ${consequence}`;
}

/** Why the list is empty, in words a first-time reader can act on. */
function zeroResultMessage(
  levelId: string | undefined,
  corrections: WorkbenchUnderstanding["spellingCorrection"],
): string {
  if (meaningSearchLevel(levelId)) {
    return "Nothing was similar enough. Try a broader query.";
  }
  const base =
    "No listing contains these words, after the switches above were applied. This is the known weakness of word matching, not an error.";
  const [fix] = corrections;
  if (fix !== undefined) {
    if (correctsSpelling(levelId)) {
      return `${base} The engine rewrote “${fix.from}” to “${fix.to}” before lookup, and still nothing matched. Chapter 9 matches meaning instead of words, so the typo does not stop it.`;
    }
    return `${base} The engine guessed that “${fix.from}” means “${fix.to}”, but chapters 1 to 3 only show the guess; they still look up the word you typed. Chapter 4 corrects the word before lookup, and chapter 9 matches meaning instead of words.`;
  }
  return `${base} Try another word, switch a lever on, or go to Chapter 9, which matches meaning instead of words.`;
}

/** The meaning-based chapters, where a word miss is not the reason for an empty list. */
function meaningSearchLevel(levelId: string | undefined): boolean {
  return (
    levelId === "level-4-hybrid" ||
    levelId === "level-5-cross-encoder" ||
    levelId === "level-6-two-tower"
  );
}

/** Chapters from spelling normalization onwards rewrite an unknown word before lookup. */
function correctsSpelling(levelId: string | undefined): boolean {
  return !(
    levelId === "level-0-evaluation" ||
    levelId === "level-1-recency" ||
    levelId === "level-1-normalization" ||
    levelId === "level-1-lexical"
  );
}

/** The next step when word matching finds nothing: the adjacent fix first, then meaning. */
function zeroResultLink(
  levelId: string | undefined,
  query: string,
  levers: WorkbenchLevers,
  corrections: WorkbenchUnderstanding["spellingCorrection"],
): { href: string; label: string } | undefined {
  if (meaningSearchLevel(levelId) || query === "") {
    return undefined;
  }
  if (corrections.length > 0 && !correctsSpelling(levelId)) {
    return {
      href: searchHref({ query, levelId: "level-1-spelling", levers }),
      label: "Try chapter 4, which corrects spelling →",
    };
  }
  return {
    href: searchHref({ query, levelId: "level-4-hybrid", levers }),
    label: "Try chapter 9, which matches meaning →",
  };
}

interface ResultsNote {
  readonly text: string;
  readonly href?: string;
  readonly linkLabel?: string;
}

const LOW_SIMILARITY = 0.4;
const NEAR_TIE = 0.0001;

/** A sentence that explains a surprise in the list before the learner has to ask. */
function noteForResults(
  current: NonNullable<WorkbenchState["view"]>,
  query: string,
): ResultsNote | null {
  const [first, second] = current.results;
  if (
    current.level.id === "level-5-cross-encoder" &&
    query.trim().toLowerCase() === "lamp under 50"
  ) {
    return {
      text: "Chapter 10 scores this query worse than chapter 9 (1.000 → 0.435). The cross-encoder reads the query and the listing text together, but it cannot see the price, so it drops the free lamp that chapter 9 ranked first. This is a measured regression, not a defect of this page.",
      href: "/scorecard?level=level-5-cross-encoder#regressions-heading",
      linkLabel: "See all chapter 10 regressions →",
    };
  }
  if (current.level.id === "level-4-hybrid") {
    const queryWords = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word !== "");
    const wordMisses = current.results.filter(
      (result) =>
        result.signals.some(
          (signal) => signal.name === "vectorSimilarity" && signal.value < LOW_SIMILARITY,
        ) && !queryWords.some((word) => result.title.toLowerCase().includes(word)),
    );
    const [example] = wordMisses;
    if (example !== undefined) {
      const count = wordMisses.length === 1 ? "One listing" : `${wordMisses.length} listings`;
      const verb = wordMisses.length === 1 ? "does" : "do";
      return {
        text: `${count} near the top ${verb} not share even one word with “${query}”: “${example.title}” is close only in meaning (low Meaning similarity). Chapter 9 finds more, and some of the extra finds are wrong: that is the trade-off it accepts.`,
      };
    }
  }
  if (
    current.level.id === "level-3-learned" &&
    first !== undefined &&
    second !== undefined &&
    Math.abs(first.score - second.score) <= Math.abs(first.score) * NEAR_TIE
  ) {
    return {
      text: "The top two scores are nearly equal: the learned model sees them as equally good, and a tiny difference decides the order. The weights came from chapter 7 clicks, with inverse-propensity weighting so rank 1 is not an automatic win. The answer key still decides which order is right here.",
      href: `/compare?q=${encodeURIComponent(query)}&left=level-2-boosting&right=level-3-learned`,
      linkLabel: "Compare with chapter 7 →",
    };
  }
  if (current.level.id === "level-3-learned" && first !== undefined) {
    return {
      text: `A learned score such as ${first.score.toFixed(3)} looks odd: it has no unit, so only the order matters. Open a listing to see each feature and the weight the model learned for it.`,
    };
  }
  return null;
}

/**
 * The search page below the top bar: ladder rail, query and levers, results, and the
 * teaching panels. Rendered on the server first; after hydration, level and lever changes
 * fetch `/api/search.json` and the URL follows, so every view stays shareable.
 */
export default function SearchWorkbench(props: Props) {
  const [state, setState] = createSignal<WorkbenchState>(props.initial);
  const [pending, setPending] = createSignal(false);
  const [draft, setDraft] = createSignal(props.initial.query);
  const [leverNote, setLeverNote] = createSignal<{ text: string; lever: LeverInfo } | null>(null);
  const [runNote, setRunNote] = createSignal<string | null>(null);
  let inFlight: AbortController | null = null;
  let hydrated = false;

  const selected = () => state().selected;
  const view = () => state().view;
  const mode = () => state().mode;
  // Chapter 1 matches words exactly as typed: the recall levers do not exist yet.
  const leversAvailable = () => state().levelId !== "level-1-recency";
  const changes = () => view()?.level.changes ?? selected()?.changes ?? "both";
  // The lesson follows the level the learner picked in the ladder, not the level a try button
  // ran, so a cross-level try does not swap the lesson away under the reader.
  const [lessonLevelId, setLessonLevelId] = createSignal(props.initial.levelId);
  const lesson = () => lessonFor(lessonLevelId());
  const lessonLevel = () => props.levels.find((level) => level.id === lessonLevelId());
  // Forward pull: the chapter after the one shown, so every chapter ends by opening the
  // next question instead of closing the topic. The learner's query carries over, so the
  // next engine answers the same question better.
  const nextLevel = () =>
    props.levels.find(
      (level) => level.ordinal === (selected()?.ordinal ?? -1) + 1 && level.implemented,
    );
  const resultKey = () => (view()?.results ?? []).map((result) => result.id).join("|");
  // The level's own description, whether a search ran (view) or the level is a preview (selected).
  const levelDetail = () => view()?.level ?? selected();
  const levelNote = () => {
    const current = view();
    return current === null ? null : noteForResults(current, state().query);
  };

  async function load(
    next: Pick<WorkbenchState, "query" | "levelId" | "levers">,
    after?: (loaded: WorkbenchState) => void,
    page = 1,
    historyMode: "replace" | "push" | "none" = "replace",
  ) {
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    setPending(true);
    const params = workbenchQuery(next.query, next.levelId, next.levers, page);
    if (historyMode !== "none") {
      const url = `/search?${params.toString()}`;
      if (historyMode === "push") {
        history.pushState(null, "", url);
      } else {
        history.replaceState(null, "", url);
      }
    }
    syncCodeLink(next.levelId);
    remember(next);
    const trail = document.getElementById("trail");
    if (trail !== null) {
      trail.textContent = `/search?q=${encodeURIComponent(next.query)}&level=${encodeURIComponent(next.levelId)}`;
    }
    try {
      const response = await fetch(`/api/search.json?${params.toString()}`, {
        signal: controller.signal,
      });
      const body = (await response.json()) as WorkbenchState;
      // A newer request superseded this one; its response must not paint stale results.
      if (inFlight === controller) {
        setState(body);
        after?.(body);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
    } finally {
      if (inFlight === controller) {
        setPending(false);
      }
    }
  }

  function goPage(page: number) {
    void load(state(), undefined, page);
  }

  function pickLevel(event: MouseEvent, levelId: string) {
    if (!hydrated) {
      return;
    }
    event.preventDefault();
    setLeverNote(null);
    setRunNote(null);
    setLessonLevelId(levelId);
    void load({ ...state(), levelId }, undefined, 1, "push");
  }

  function toggleLever(lever: LeverInfo) {
    const before = resultKey();
    const turnedOn = !state().levers[lever.name];
    const levers = { ...state().levers, [lever.name]: turnedOn };
    const query = state().query;
    const strictChapter = state().levelId === "level-1-recency";
    void load({ ...state(), levers }, (loaded) => {
      const after = (loaded.view?.results ?? []).map((result) => result.id).join("|");
      setLeverNote(
        query === ""
          ? null
          : {
              lever,
              text: leverNoteText(lever, turnedOn, query, before === after, strictChapter),
            },
      );
    });
  }

  function demoLever(lever: LeverInfo) {
    setDraft(lever.demoQuery);
    const levers = { ...ALL_ON, [lever.name]: false };
    const strictChapter = state().levelId === "level-1-recency";
    void load({ query: lever.demoQuery, levelId: state().levelId, levers }, () => {
      setLeverNote({
        lever,
        text: strictChapter
          ? `“${lever.demoQuery}” with ${lever.label.toLowerCase()} off. Chapter 1 has no switches yet, so switching it on changes nothing here. Try the same switch at chapter 2 to watch it work.`
          : `“${lever.demoQuery}” with ${lever.label.toLowerCase()} off. Now switch it on and watch the list.`,
      });
    });
  }

  function submit(event: SubmitEvent) {
    if (!hydrated) {
      return;
    }
    event.preventDefault();
    setLeverNote(null);
    setRunNote(null);
    void load({ ...state(), query: draft().trim() });
  }

  function tryHref(attempt: LessonTry): string {
    if (attempt.grade === true) {
      return gradeHref(attempt.query, attempt.levelId ?? "level-1-recency");
    }
    return searchHref({
      query: attempt.query,
      levelId: attempt.levelId ?? lessonLevelId(),
      levers: attempt.levers ?? ALL_ON,
    });
  }

  function runTry(attempt: LessonTry, event: MouseEvent) {
    if (!hydrated) {
      return;
    }
    event.preventDefault();
    setLeverNote(null);
    setRunNote(null);
    if (attempt.grade === true) {
      const detail: GradeRequest = {
        query: attempt.query,
        levelId: attempt.levelId ?? "level-1-recency",
      };
      document.dispatchEvent(new CustomEvent(GRADE_EVENT, { detail }));
      return;
    }
    setDraft(attempt.query);
    void load(
      {
        query: attempt.query,
        levelId: attempt.levelId ?? lessonLevelId(),
        levers: attempt.levers ?? ALL_ON,
      },
      (loaded) => {
        const loadedView = loaded.view;
        if (loadedView === null || loadedView === undefined) {
          return;
        }
        const levelId = loadedView.level.id;
        const ordinal = loadedView.level.ordinal;
        const count = loadedView.candidateWidth;
        const plural = count === 1 ? "" : "s";
        const message =
          levelId === "level-5-cross-encoder"
            ? `Chapter ${ordinal} reranked ${count} candidates for “${attempt.query}”.`
            : levelId === "level-6-two-tower"
              ? `Chapter ${ordinal} built a candidate set of ${count} listings for “${attempt.query}”.`
              : `Chapter ${ordinal} matched ${count} listing${plural} for “${attempt.query}”.`;
        setRunNote(message);
      },
    );
  }

  /** Reading progress for the contents page: which chapters were opened, and where the reader is. */
  function remember(place: Pick<WorkbenchState, "query" | "levelId" | "levers">) {
    markVisited(place.levelId);
    rememberPlace({ levelId: place.levelId, query: place.query, href: searchHref(place) });
  }

  // Set after hydration so the server-rendered links still work without JavaScript.
  onMount(() => {
    hydrated = true;
    remember(state());
    syncCodeLink(state().levelId);
    // Browser Back/Forward: restore the query, level, levers and page the URL names.
    const onPopState = () => {
      const next = requestFromUrl();
      setLeverNote(null);
      setRunNote(null);
      setDraft(next.query);
      setLessonLevelId(next.levelId);
      void load(next, undefined, next.page, "none");
    };
    window.addEventListener("popstate", onPopState);
    // The guided tour runs real queries through this event, so the reader sees the behaviour.
    const onTourRun = (event: Event) => {
      const run = (event as CustomEvent<TourRun>).detail;
      setLeverNote(null);
      setDraft(run.query);
      setLessonLevelId(run.levelId);
      void load(run);
    };
    document.addEventListener(TOUR_RUN_EVENT, onTourRun);
    onCleanup(() => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener(TOUR_RUN_EVENT, onTourRun);
    });
  });

  const chapters = () => props.levels.filter((level) => level.ordinal > 0);
  const intro = () => props.levels.find((level) => level.ordinal === 0);
  const shipped = () => chapters().filter((level) => level.implemented).length;

  const ladderItem = (level: LevelListItem) => {
    const isSelected = () => level.id === state().levelId;
    const blocked = level.implemented && level.prerequisiteState !== "ready";
    const isIntro = level.ordinal === 0;
    const question = lessonFor(level.id)?.question ?? level.capability;
    return (
      <li>
        <a
          href={searchHref({ ...state(), levelId: level.id })}
          aria-current={isSelected() ? "true" : undefined}
          onClick={(event) => pickLevel(event, level.id)}
          class="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-ink no-underline transition-colors hover:bg-paper-2 hover:text-ink"
          classList={{
            "border-rule bg-surface shadow-[0_1px_0_rgba(38,33,27,0.04)]": isSelected(),
            "border-transparent": !isSelected(),
          }}
        >
          <span
            class="flex h-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors"
            classList={{
              "w-6": !isIntro,
              "px-2 text-[10.5px] uppercase tracking-[0.04em]": isIntro,
              "bg-amber text-surface": isSelected(),
              "bg-paper-3 text-ink-2": !isSelected() && level.implemented,
              "border border-dashed border-ink-5 text-ink-4": !level.implemented,
            }}
          >
            {isIntro ? "Intro" : level.ordinal}
          </span>
          <span class="min-w-0 grow">
            <span class="flex items-center justify-between gap-2">
              <span class="text-[13.5px] font-semibold">
                {isIntro ? "How we keep score" : level.label}
              </span>
              <Show when={!level.implemented}>
                <span class="tag tag-preview">Read-only</span>
              </Show>
              <Show when={blocked}>
                <span class="tag tag-warn">{level.prerequisiteState}</span>
              </Show>
            </span>
            <span class="mt-0.5 block text-xs leading-[1.4] text-ink-3">{question}</span>
          </span>
        </a>
      </li>
    );
  };

  return (
    <div class="grid items-start gap-6 px-4 pb-8 pt-6 sm:px-7 lg:grid-cols-[272px_minmax(0,1fr)_400px]">
      <aside
        class="flex min-w-0 flex-col gap-2.5 max-lg:order-3 lg:sticky lg:top-6"
        aria-label="Contents"
        data-tour="ladder"
      >
        <div class="flex items-baseline justify-between px-3">
          <span class="eyebrow tracking-[0.06em]">Introduction</span>
          <span class="text-[11.5px] text-ink-4">read first · 5 minutes</span>
        </div>
        <ol class="m-0 flex list-none flex-col gap-0.5 p-0">
          <Show when={intro()}>{(level) => ladderItem(level())}</Show>
        </ol>
        <div class="mt-1.5 flex items-baseline justify-between px-3">
          <span class="eyebrow tracking-[0.06em]">Chapters</span>
          <span class="text-[11.5px] text-ink-4">
            {shipped()} you can run · {chapters().length - shipped()} read-only
          </span>
        </div>
        <ol class="m-0 flex list-none flex-col gap-0.5 p-0">
          <For each={chapters()}>{ladderItem}</For>
        </ol>
        <div class="note mt-1">
          <div class="mb-0.5 font-semibold text-ink">New here?</div>
          Read the introduction: it shows how a search result is graded, and every chapter ends with
          that grade. Then start at chapter 1 and follow the lesson on the right: start simple,
          where it breaks, the fix, what it is called. The Tour button at the top shows you around
          this page.
        </div>
      </aside>

      <div class="flex min-w-0 flex-col gap-4 max-lg:order-1" aria-busy={pending()}>
        <details class="card lg:hidden">
          <summary class="cursor-pointer px-4 py-3 font-serif text-[15px] font-semibold">
            Chapters
          </summary>
          <ol class="m-0 flex list-none flex-col gap-0.5 p-2">
            <Show when={intro()}>{(level) => ladderItem(level())}</Show>
            <For each={chapters()}>{ladderItem}</For>
          </ol>
        </details>
        <Show when={mode() === "evaluation" && state().error === null}>
          <section class="flex flex-col gap-1.5 px-1">
            <span class="eyebrow tracking-[0.06em]">Introduction · How we keep score</span>
            <h2 class="m-0 font-serif text-[26px] font-medium leading-tight tracking-[-0.01em]">
              Before we improve a search, we need a way to say whether it got better.
            </h2>
            <p class="m-0 max-w-[64ch] font-serif text-[15.5px] text-ink-2">
              <Terms text="The answer key below (the judgment set) grades listings from 0 to 3 for a set of test queries. Pick a test query and a chapter: the table shows what the chapter put in its top 10, what each row is worth, and the one number that sums it up. Then click another chapter and see the number move. Every chapter of this book ends with this number. This page grades rankings and runs no search of its own; the live search results start in chapter 1." />
            </p>
          </section>
          <EvaluationLab
            queries={props.teachingQueries}
            levels={props.levels}
            initialQuery={props.initial.query}
            initialLevelId={props.gradeLevelId}
          />
          <div class="flex flex-wrap gap-2.5">
            <a class="btn" href="/search?q=sofa&level=level-1-recency">
              Start chapter 1<span aria-hidden="true">→</span>
            </a>
            <a class="btn-ghost" href="/scorecard">
              All test queries, every chapter: the scorecard
            </a>
          </div>
        </Show>

        <Show when={mode() === "search"}>
          <form method="get" action="/search" class="flex flex-col gap-4" onSubmit={submit}>
            <input type="hidden" name="level" value={state().levelId} />
            <input type="hidden" name="levers" value="explicit" />
            <div class="flex items-center gap-2.5" data-tour="query">
              <div class="relative min-w-0 grow">
                <svg
                  class="pointer-events-none absolute left-3.5 top-[13px] text-ink-4"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  class="input pl-10 pr-3.5"
                  type="search"
                  name="q"
                  value={draft()}
                  onInput={(event) => setDraft(event.currentTarget.value)}
                  maxlength="200"
                  autocomplete="off"
                  placeholder="Try sofa, couch, carpet, marble, or ligth"
                  aria-label="Query"
                />
              </div>
              <button type="submit" class="btn shrink-0">
                Search
              </button>
            </div>
            <Show when={mode() === "search"}>
              <div data-tour="switches">
                <Show
                  when={leversAvailable()}
                  fallback={
                    <p class="m-0 text-xs text-ink-3">
                      Chapter 1 matches words exactly as typed: there are no switches yet. Chapter 2
                      adds stemming, synonyms and spelling variants.
                    </p>
                  }
                >
                  <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <legend class="eyebrow float-left mr-1 tracking-[0.06em]">
                        Word switches (recall levers)
                      </legend>
                      <For each={LEVERS}>
                        {(lever) => (
                          <label
                            class="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-rule-2 bg-surface py-1.5 pl-2 pr-2.5 text-[12.5px] font-medium transition-colors hover:border-ink-5"
                            classList={{
                              "text-ink": state().levers[lever.name],
                              "text-ink-4": !state().levers[lever.name],
                            }}
                            title={lever.effect}
                          >
                            <input
                              type="checkbox"
                              name={lever.name}
                              value="1"
                              checked={state().levers[lever.name]}
                              onChange={() => toggleLever(lever)}
                              class="peer sr-only"
                            />
                            <span
                              aria-hidden="true"
                              class="relative h-4 w-[26px] rounded-full transition-colors after:absolute after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-surface after:transition-[left] after:duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber"
                              classList={{
                                "bg-blue after:left-3": state().levers[lever.name],
                                "bg-rule-2 after:left-0.5": !state().levers[lever.name],
                              }}
                            />
                            {lever.label}
                          </label>
                        )}
                      </For>
                      <span class="ml-auto text-xs text-ink-4">
                        Each switch finds more listings, and some of the extra finds are wrong.
                      </span>
                    </div>
                    <Show
                      when={leverNote()}
                      fallback={
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span>See a switch matter:</span>
                          <For each={LEVERS}>
                            {(lever) => (
                              <button
                                type="button"
                                class="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-semibold text-amber-deep underline-offset-2 hover:underline"
                                onClick={() => demoLever(lever)}
                              >
                                {lever.label.toLowerCase()} on “{lever.demoQuery}”
                              </button>
                            )}
                          </For>
                        </div>
                      }
                    >
                      {(note) => (
                        <div
                          role="status"
                          class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-blue-soft px-3 py-2 text-[12.5px] text-blue-deep"
                        >
                          <span>{note().text}</span>
                          <Show when={!note().text.startsWith(`“${note().lever.demoQuery}”`)}>
                            <button
                              type="button"
                              class="cursor-pointer border-0 bg-transparent p-0 font-sans text-[12.5px] font-semibold text-blue-deep underline"
                              onClick={() => demoLever(note().lever)}
                            >
                              Show me with “{note().lever.demoQuery}”
                            </button>
                          </Show>
                        </div>
                      )}
                    </Show>
                  </fieldset>
                </Show>
              </div>
            </Show>
          </form>
        </Show>

        <Show when={mode() === "preview" && selected()}>
          {(level) => (
            <section class="card flex flex-col gap-3 border-dashed px-7 py-6">
              <div class="flex items-center gap-2.5">
                <span class="tag tag-preview">Explained, not built</span>
                <span class="text-[12.5px] text-ink-4">
                  This chapter is not implemented in this release. Nothing runs here.
                </span>
              </div>
              <h2 class="m-0 font-serif text-2xl font-medium tracking-[-0.01em]">
                {lesson()?.question ?? level().label}
              </h2>
              <p class="m-0 max-w-[62ch] font-serif text-base text-ink-2">
                <Terms text={level().capability} />
              </p>
              <p class="note m-0 max-w-[62ch]">
                Read the four-step lesson on the right. To run a search again, go back to a chapter
                that runs.
              </p>
            </section>
          )}
        </Show>

        <div class="flex flex-col gap-4" data-tour="results">
          <Show when={runNote()}>
            {(note) => (
              <p
                role="status"
                class="m-0 rounded-lg bg-blue-soft px-3 py-2 text-[12.5px] text-blue-deep"
              >
                {note()}
              </p>
            )}
          </Show>
          <Show when={mode() === "search" && state().query === "" && state().error === null}>
            <StateCard
              kind="empty"
              title="Type a query, or press a try button in the lesson"
              message="The ranked listings for the selected level appear here. Click a listing to see the signals that placed it."
            />
          </Show>
          <Show when={state().error}>
            {(error) => (
              <StateCard
                kind={error().kind}
                title={
                  error().kind === "over-length"
                    ? "Query too long"
                    : "This level is not available right now"
                }
                message={error().message}
                command={error().command}
              />
            )}
          </Show>
          <Show when={view()?.results.length === 0}>
            <StateCard
              kind="zero"
              title="No listing matched at this level"
              message={zeroResultMessage(
                selected()?.id,
                view()?.understanding.spellingCorrection ?? [],
              )}
              link={zeroResultLink(
                selected()?.id,
                state().query,
                state().levers,
                view()?.understanding.spellingCorrection ?? [],
              )}
            />
          </Show>
          <Show when={view() !== null && (view()?.results.length ?? 0) > 0 ? view() : null}>
            {(current) => (
              <section
                class="card transition-opacity duration-200"
                classList={{ "opacity-60": pending() }}
                aria-label="Ranked results"
              >
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
                  <div class="flex flex-wrap items-center gap-3.5 text-[12.5px] text-ink-2">
                    <span>
                      <strong class="text-ink">
                        {current().results[0]?.position}–{current().results.at(-1)?.position}
                      </strong>{" "}
                      of {current().candidateWidth}
                    </span>
                    <span class="text-rule-2">|</span>
                    <span class="term">
                      <span class="term-word" tabindex="0">
                        <strong class="font-mono text-ink">{current().candidateWidth}</strong>{" "}
                        {current().level.id === "level-5-cross-encoder" ? "reranked" : "matched"}
                      </span>
                      <span role="tooltip">
                        {current().level.id === "level-5-cross-encoder"
                          ? "The first 50 listings from chapter 9, rescored by the cross-encoder. Earlier retrieval can match more; this chapter only reorders this short list."
                          : "The candidate set: every listing that matched at all. Scoring only orders these; it cannot add to them."}
                      </span>
                    </span>
                    <span class="text-rule-2">|</span>
                    <span class="term">
                      <span class="term-word" tabindex="0">
                        <strong class="font-mono text-ink">
                          {current().elapsedMs < 1 ? "< 1" : current().elapsedMs} ms
                        </strong>
                      </span>
                      <span role="tooltip">
                        Time to produce this ranking here, with the model already loaded. The
                        scorecard reports per-query latency across all test queries, so its numbers
                        are larger.
                      </span>
                    </span>
                  </div>
                  <div class="flex gap-1.5">
                    <Show when={current().level.changes !== "scoring"}>
                      <span class="tag tag-match">changes which listings match</span>
                    </Show>
                    <Show when={current().level.changes !== "matching"}>
                      <span class="tag tag-score">changes the order</span>
                    </Show>
                  </div>
                </div>
                <Show when={levelNote()}>
                  {(note) => (
                    <p class="m-0 flex flex-wrap items-baseline gap-x-2 border-b border-rule-soft bg-amber-tint/60 px-4 py-2.5 text-[12.5px] leading-snug text-ink-2">
                      <span>{note().text}</span>
                      <Show when={note().href}>
                        {(href) => (
                          <a class="font-semibold" href={href()}>
                            {note().linkLabel}
                          </a>
                        )}
                      </Show>
                    </p>
                  )}
                </Show>
                <Show when={current().understanding.appliedCorrections.length > 0}>
                  <p class="m-0 flex flex-wrap items-baseline gap-x-2 border-b border-rule-soft bg-blue-soft px-4 py-2.5 text-[12.5px] leading-snug text-blue-deep">
                    <span>
                      Showing results for{" "}
                      {current()
                        .understanding.appliedCorrections.map(
                          (fix) => `“${fix.to}” (you searched “${fix.from}”)`,
                        )
                        .join("; ")}
                      .
                    </span>
                    <a
                      class="font-semibold"
                      href="/level/level-1-spelling?file=src/domain/text/spell-correction.ts"
                    >
                      How the correction works →
                    </a>
                  </p>
                </Show>
                <ResultRows
                  results={current().results}
                  scoreLabel={scoreLabelFor(current().level.id)}
                  scoreMeaning={scoreMeaningFor(current().level.id)}
                  levelId={current().level.id}
                  animate={true}
                />
                <Show when={current().pageCount > 1}>
                  <nav
                    class="flex flex-wrap items-center justify-between gap-2 border-t border-rule-soft px-4 py-2.5 text-[12.5px]"
                    aria-label="Result pages"
                  >
                    <button
                      type="button"
                      class="btn-ghost px-2 py-1 text-[12.5px]"
                      disabled={current().page <= 1}
                      onClick={() => goPage(current().page - 1)}
                    >
                      Previous
                    </button>
                    <span class="text-ink-2">
                      Page {current().page} of {current().pageCount}
                    </span>
                    <button
                      type="button"
                      class="btn-ghost px-2 py-1 text-[12.5px]"
                      disabled={current().page >= current().pageCount}
                      onClick={() => goPage(current().page + 1)}
                    >
                      Next
                    </button>
                  </nav>
                </Show>
                <div class="border-t border-rule-soft px-4 py-2.5 text-[12.5px] text-ink-3">
                  Click a listing to see the signals that placed it. Switch level on the left: rows
                  slide to their new rank. Every matching listing is on some page.
                </div>
              </section>
            )}
          </Show>
          <Show when={lessonLevelId() === "level-6-two-tower"}>
            <TwoTowerLab
              anchorId="two-tower-lab"
              state={state()}
              onTry={runTry}
              levelOrdinal={lessonLevel()?.ordinal ?? 11}
            />
          </Show>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-4 max-lg:order-2">
        <Show when={lesson()}>
          {(current) => (
            <div data-tour="lesson">
              <LessonCard
                lesson={current()}
                levelId={lessonLevelId()}
                href={tryHref}
                onTry={runTry}
                viewingOther={
                  state().levelId === lessonLevelId()
                    ? null
                    : {
                        label: `The list shows level ${selected()?.ordinal ?? "?"}. Back to level ${lessonLevel()?.ordinal ?? "?"}`,
                        href: searchHref({ ...state(), levelId: lessonLevelId() }),
                        onBack: (event: MouseEvent) => pickLevel(event, lessonLevelId()),
                      }
                }
              />
            </div>
          )}
        </Show>

        <Show when={mode() === "search" ? selected() : null}>
          {(level) => (
            <div data-tour="checkpoint">
              <Checkpoint levelId={level().id} ordinal={level().ordinal} query={state().query} />
            </div>
          )}
        </Show>

        <Show when={mode() === "search" ? nextLevel() : null}>
          {(next) => (
            <a
              href={searchHref({
                query: state().query,
                levelId: next().id,
                levers: state().levers,
              })}
              class="card flex items-center justify-between gap-3 px-[18px] py-3.5 text-ink no-underline transition-colors hover:bg-surface-warm hover:text-ink"
            >
              <span class="min-w-0">
                <span class="eyebrow block">Next · chapter {next().ordinal}</span>
                <span class="mt-0.5 block font-serif text-[15px] text-ink-2">
                  <Terms text={lessonFor(next().id)?.question ?? next().label} />
                </span>
              </span>
              <span class="shrink-0 text-[13px] font-semibold text-amber-deep">Continue →</span>
            </a>
          )}
        </Show>

        <Show when={view()}>
          {(current) => (
            <div data-tour="looked-for">
              <Understanding
                understanding={current().understanding}
                strictMatching={current().level.id === "level-1-recency"}
                levelId={current().level.id}
              />
            </div>
          )}
        </Show>

        <Show when={mode() === "evaluation" && state().error === null}>
          <a
            href="/level/level-1-lexical?file=src/domain/evaluation/ndcg.ts&symbol=ndcgAt"
            class="card flex items-center justify-between gap-3 px-[18px] py-3.5 text-ink no-underline transition-colors hover:bg-surface-warm hover:text-ink"
          >
            <span class="min-w-0">
              <span class="eyebrow block">The code behind the number</span>
              <span class="mt-0.5 block text-[13px] text-ink-2">{lesson()?.codeFocus}</span>
              <span class="mt-0.5 block truncate font-mono text-[11.5px] text-ink-4">
                src/domain/evaluation/ndcg.ts
              </span>
            </span>
            <span class="btn-ghost shrink-0">Read it</span>
          </a>
        </Show>

        <EngineeringPanel
          ordinal={selected()?.ordinal}
          changes={changes()}
          level={levelDetail()}
          hidden={mode() === "evaluation"}
        />

        <section
          class="card flex flex-col gap-2.5 px-[18px] py-4"
          classList={{ hidden: mode() === "evaluation" }}
        >
          <div class="flex items-center justify-between">
            <h2 class="h2">Checked example</h2>
            <span class="text-[11.5px] text-ink-4">runnable inventory example</span>
          </div>
          <Show
            when={state().examples.length > 0}
            fallback={
              <p class="m-0 font-serif text-[15px] text-ink-2">
                This chapter is explained, not built, so there is nothing to run yet.
              </p>
            }
          >
            <For each={state().examples}>
              {(example) => (
                <article class="flex flex-col gap-2.5">
                  <div class="flex items-center gap-2.5">
                    <span class="chip border border-rule bg-surface px-2.5 py-[5px] text-sm">
                      {example.queryText}
                    </span>
                    <Show when={(example.comparedWithOrdinal ?? 0) !== 0}>
                      <span class="text-[12.5px] text-ink-3">
                        compared with chapter {example.comparedWithOrdinal}
                      </span>
                    </Show>
                  </div>
                  <p class="m-0 font-serif text-[15px] text-ink">
                    <Terms text={example.expectedDifference} />
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <Show
                      when={state().query !== example.queryText}
                      fallback={
                        <span class="tag tag-ok h-[34px] px-3 text-[11px]">shown in the list</span>
                      }
                    >
                      <a
                        class="btn-ghost"
                        href={tryHref({
                          label: "",
                          query: example.queryText,
                          levelId: state().levelId,
                        })}
                        onClick={(event) =>
                          runTry(
                            { label: "", query: example.queryText, levelId: state().levelId },
                            event,
                          )
                        }
                      >
                        Run it here
                      </a>
                    </Show>
                    <a
                      class="btn-ghost"
                      href={`/compare?q=${encodeURIComponent(example.queryText)}&left=${encodeURIComponent(example.comparedWithLevelId)}&right=${encodeURIComponent(state().levelId)}`}
                    >
                      See both levels side by side
                    </a>
                  </div>
                </article>
              )}
            </For>
          </Show>
        </section>

        <Show when={selected()?.implemented && (selected()?.ordinal ?? 0) > 0}>
          <a
            href={`/level/${encodeURIComponent(state().levelId)}`}
            data-tour="code"
            class="card flex items-center justify-between gap-3 px-[18px] py-3.5 text-ink no-underline transition-colors hover:bg-surface-warm hover:text-ink"
          >
            <span class="min-w-0">
              <span class="eyebrow block">The code that just ran</span>
              <span class="mt-0.5 block text-[13px] text-ink-2">{lesson()?.codeFocus}</span>
              <span class="mt-0.5 block text-[12px] text-ink-3">
                Numbered notes explain the lines that matter. Click any function the code calls to
                open it in place, and come back with one key.
              </span>
              <span class="mt-0.5 block truncate font-mono text-[11.5px] text-ink-4">
                src/domain/levels/{state().levelId}.ts
              </span>
            </span>
            <span class="btn-ghost shrink-0">
              Read it
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </span>
          </a>
        </Show>
      </div>
    </div>
  );
}

function Understanding(props: {
  understanding: WorkbenchUnderstanding;
  strictMatching?: boolean;
  levelId?: string;
}) {
  const original = () => new Set(props.understanding.tokens);
  const afterVariants = () => new Set(props.understanding.normalizedTokens);
  const strict = () => props.strictMatching === true;
  const steps = () => [
    { key: "Your words", tokens: props.understanding.tokens, isNew: () => false },
    {
      key: "Normalised",
      tokens: props.understanding.normalizedTokens,
      isNew: (token: string) => !original().has(token),
    },
    {
      key: strict() ? "With synonyms (ignored here)" : "With synonyms",
      tokens: props.understanding.expandedTokens,
      isNew: (token: string) => !(strict() || afterVariants().has(token)),
    },
  ];
  const hasAdded = () => steps().some((step) => step.tokens.some((token) => step.isNew(token)));
  return (
    <section class="card flex flex-col gap-3 px-[18px] py-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">What the engine looked for</h2>
        <span class="tag tag-match">before matching</span>
      </div>
      <div class="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
        <span class="eyebrow">Your words</span>
        <div class="flex flex-wrap gap-1.5">
          <Show
            when={props.understanding.tokens.length > 0}
            fallback={<span class="text-xs text-ink-4">(none)</span>}
          >
            <For each={props.understanding.tokens}>
              {(token) => <span class="chip">{token}</span>}
            </For>
          </Show>
        </div>
      </div>
      <Show
        when={!strict()}
        fallback={
          <p class="m-0 text-xs text-ink-3">
            Chapter 1 looks your words up exactly as typed. Stemming, synonyms and spelling variants
            do not apply yet; they arrive in chapter 2.
          </p>
        }
      >
        <For each={steps().slice(1)}>
          {(step) => (
            <div class="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
              <span class="eyebrow">{step.key}</span>
              <div class="flex flex-wrap gap-1.5">
                <Show
                  when={step.tokens.length > 0}
                  fallback={<span class="text-xs text-ink-4">(none)</span>}
                >
                  <For each={step.tokens}>
                    {(token) => (
                      <span
                        class="chip"
                        classList={{ "chip-new": step.isNew(token) }}
                        title={
                          step.key === "Normalised" && step.isNew(token)
                            ? `“${token}” is a stem: the word with its ending cut, so that its forms all match one entry. Not a typo.`
                            : undefined
                        }
                      >
                        {token}
                      </span>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          )}
        </For>
      </Show>
      <Show when={props.understanding.appliedCorrections.length > 0}>
        <p class="m-0 text-xs text-ink-3">
          Looked up as the corrected words in the blue banner above; the rows show what you typed.
        </p>
      </Show>
      <Show when={props.understanding.predictedCategoryId}>
        {(category) => (
          <div class="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
            <span class="eyebrow">Category</span>
            <div class="flex items-center gap-2">
              <span class="chip bg-amber-soft text-amber-deep">{category()}</span>
              <span class="text-xs text-ink-3">guessed from your words</span>
            </div>
          </div>
        )}
      </Show>
      <Show when={props.understanding.spellingCorrection.length > 0}>
        <div class="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
          <span class="eyebrow">Spelling</span>
          <div class="flex flex-wrap items-baseline gap-1.5">
            <For each={props.understanding.spellingCorrection}>
              {(fix) => (
                <span class="chip">
                  {fix.from} → {fix.to}
                </span>
              )}
            </For>
            <span class="text-xs text-ink-3">
              {props.understanding.appliedCorrections.length > 0
                ? "applied before lookup"
                : "guess only — chapters 1 to 3 still look up what you typed"}
            </span>
          </div>
        </div>
      </Show>
      <Show when={props.understanding.concepts.length > 0}>
        <div class="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
          <span class="eyebrow">Concepts</span>
          <div class="flex flex-wrap items-baseline gap-1.5">
            <For each={props.understanding.concepts}>
              {(concept) => (
                <a
                  class="chip"
                  classList={{ "chip-new": !concept.preview }}
                  href={`/level/${props.levelId ?? "level-1-entities"}?file=src/domain/query-understanding/entities.ts`}
                  title={
                    concept.preview
                      ? "What chapter 5 would enforce for this query. Preview only: this chapter still matches words."
                      : "The ontology table that defines this concept. Every concept must hold; each may hold in words or in listing fields."
                  }
                >
                  {concept.type === "location" ? "city" : concept.type}: {concept.value}
                  {concept.preview ? " (preview)" : ""}
                </a>
              )}
            </For>
          </div>
        </div>
      </Show>
      <p class="m-0 text-xs text-ink-3">
        <Show
          when={props.strictMatching === true}
          fallback={
            <>
              <Show when={hasAdded()}>
                Blue chips were added by a switch. Every added word lets more listings match.
              </Show>
              <Show when={!hasAdded()}>
                The switches added no word for this query: its words are already in the form the
                index looks up.
              </Show>
            </>
          }
        >
          Chapter 1 matches your words exactly as typed. There are no switches yet; chapter 2 adds
          them.
        </Show>
        <Show
          when={
            !strict() &&
            props.understanding.normalizedTokens.some((token) => !original().has(token))
          }
        >
          {" "}
          A cut word such as “curtain” is a stem, not a typo: “curtain” and “curtains” all become
          the same stem, so they all match one entry.
        </Show>
      </p>
    </section>
  );
}

/** What a chapter is called, what it does, and what it gives up. Static for preview chapters too. */
function EngineeringPanel(props: {
  ordinal: number | undefined;
  changes: "matching" | "scoring" | "both";
  level: {
    readonly capability: string;
    readonly mechanism: string;
    readonly tradeOff: string;
    readonly fixesFailureMode: string | null;
  } | null;
  hidden: boolean;
}) {
  const changesSentence = () => {
    if (props.changes === "both") {
      return "This level changes both.";
    }
    if (props.changes === "matching") {
      return "This level changes matching only.";
    }
    return "This level changes scoring only; it takes the candidates from the level below.";
  };
  return (
    <section class="card flex flex-col gap-3.5 px-[18px] py-4" classList={{ hidden: props.hidden }}>
      <div class="flex items-center justify-between">
        <h2 class="h2">Chapter {props.ordinal ?? "?"} in engineering terms</h2>
        <div class="flex gap-1">
          <Show when={props.changes !== "scoring"}>
            <span class="tag tag-match">matching</span>
          </Show>
          <Show when={props.changes !== "matching"}>
            <span class="tag tag-score">scoring</span>
          </Show>
        </div>
      </div>
      <dl class="m-0 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5">
        <dt class="kv-key">Capability</dt>
        <dd class="kv-val m-0">
          <Terms text={props.level?.capability ?? ""} />
        </dd>
        <Show when={props.level}>
          {(current) => (
            <>
              <dt class="kv-key">Mechanism</dt>
              <dd class="kv-val m-0">
                <Terms text={current().mechanism} />
              </dd>
              <dt class="kv-key">Trade-off</dt>
              <dd class="kv-val m-0">
                <Terms text={current().tradeOff} />
              </dd>
              <Show when={current().fixesFailureMode}>
                {(fixes) => (
                  <>
                    <dt class="kv-key">Fixes</dt>
                    <dd class="kv-val m-0">
                      <Terms text={fixes()} />
                    </dd>
                  </>
                )}
              </Show>
            </>
          )}
        </Show>
      </dl>
      <p class="note m-0 flex items-start gap-2.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <span>
          <strong class="text-blue-deep">Matching</strong> decides which listings are candidates.{" "}
          <strong class="text-amber-deep">Scoring</strong> decides their order. {changesSentence()}
          Dotted words have a definition: hover or tap them.
        </span>
      </p>
    </section>
  );
}

function StateCard(props: {
  kind: "empty" | "zero" | "over-length" | "unavailable";
  title: string;
  message: string;
  command?: string | null;
  /** Optional next step, shown under the message. */
  link?: { href: string; label: string } | undefined;
}) {
  return (
    <div
      role="status"
      data-state={props.kind}
      class="card flex items-start gap-3.5 px-5 py-4"
      classList={{ "border-dashed": props.kind === "unavailable" }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mt-0.5 shrink-0 text-ink-3"
        aria-hidden="true"
      >
        <Show
          when={props.kind === "empty"}
          fallback={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </>
          }
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </Show>
      </svg>
      <div class="flex flex-col gap-1">
        <span class="font-serif text-[17px] font-semibold">{props.title}</span>
        <p class="m-0 text-[13.5px] text-ink-2">{props.message}</p>
        <Show when={props.command}>
          {(command) => (
            <code class="mt-1 self-start rounded-md bg-paper px-2.5 py-1.5 font-mono text-xs text-ink">
              {command()}
            </code>
          )}
        </Show>
        <Show when={props.link}>
          {(link) => (
            <a class="mt-0.5 text-[13px] font-semibold" href={link().href}>
              {link().label}
            </a>
          )}
        </Show>
      </div>
    </div>
  );
}
