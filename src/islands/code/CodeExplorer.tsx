import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { CodeDefinition, CodeLink, CodeModuleView } from "../../actions/get-code-module.ts";
import Terms from "../search/Terms.tsx";
import CodeRow from "./CodeRow.tsx";

interface Frame {
  readonly view: CodeModuleView;
  /** Symbol the reader opened; null for the level file itself. */
  readonly symbol: string | null;
  /** Line in the previous frame the reader came from, so Back can return there. */
  readonly fromLine: number | null;
}

interface Props {
  readonly root: CodeModuleView;
  readonly rootLabel: string;
  readonly compositionLine: number | null;
  readonly composesLabel: string | null;
  /** A deep link opened on the server: the module named in the URL. */
  readonly initial: CodeModuleView | null;
  readonly initialSymbol: string | null;
}

const FLASH_MS = 1600;

/**
 * Reads one module with numbered callouts, opens any function it calls in place, and comes back.
 * Breadcrumbs, Back (Escape / Alt+Left), browser history and deep links all agree on the trail.
 */
export default function CodeExplorer(props: Props) {
  const rootFrame: Frame = { view: props.root, symbol: null, fromLine: null };
  const [frames, setFrames] = createSignal<readonly Frame[]>(
    props.initial === null
      ? [rootFrame]
      : [rootFrame, { view: props.initial, symbol: props.initialSymbol, fromLine: null }],
  );
  const [pending, setPending] = createSignal(false);
  const [activeNote, setActiveNote] = createSignal<number | null>(null);
  const [flashLine, setFlashLine] = createSignal<number | null>(null);
  const [wholeFile, setWholeFile] = createSignal(false);
  const [jumpBack, setJumpBack] = createSignal<number | null>(null);
  const cache = new Map<string, CodeModuleView>([[props.root.path, props.root]]);
  if (props.initial !== null) {
    cache.set(props.initial.path, props.initial);
  }
  const [codeRegion, setCodeRegion] = createSignal<HTMLElement>();
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const top = () => frames().at(-1) ?? rootFrame;
  const depth = () => frames().length - 1;
  const focused = createMemo<CodeDefinition | null>(() => {
    const symbol = top().symbol;
    if (symbol === null) {
      return null;
    }
    return top().view.definitions.find((entry) => entry.symbol === symbol) ?? null;
  });
  const focusRange = () => (wholeFile() ? null : focused());
  const isDimmed = (line: number) => {
    const range = focusRange();
    return range !== null && (line < range.startLine || line > range.endLine);
  };

  /** The exported `meta` block of a level file is folded until the reader asks for it. */
  const metaRange = () => top().view.definitions.find((entry) => entry.symbol === "meta") ?? null;
  const [metaFolded, setMetaFolded] = createSignal(true);
  const hiddenByFold = (line: number) => {
    const range = metaRange();
    return metaFolded() && range !== null && line >= range.startLine && line <= range.endLine;
  };

  function scrollTo(line: number, flash: boolean, align: "center" | "top" = "center") {
    const region = codeRegion();
    if (region === undefined) {
      return;
    }
    const row = region.querySelector<HTMLElement>(`[data-line="${line}"]`);
    if (row === null) {
      return;
    }
    const offset =
      align === "top" ? row.offsetHeight * 2.5 : region.clientHeight / 2 - row.offsetHeight / 2;
    region.scrollTo({ top: row.offsetTop - offset, behavior: "smooth" });
    if (flash) {
      setFlashLine(line);
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => setFlashLine(null), FLASH_MS);
    }
  }

  function syncUrl() {
    const current = top();
    const url = new URL(window.location.href);
    if (current.view.path === props.root.path) {
      url.searchParams.delete("file");
      url.searchParams.delete("symbol");
    } else {
      url.searchParams.set("file", current.view.path);
      if (current.symbol === null) {
        url.searchParams.delete("symbol");
      } else {
        url.searchParams.set("symbol", current.symbol);
      }
    }
    return url;
  }

  async function fetchModule(path: string): Promise<CodeModuleView | null> {
    const cached = cache.get(path);
    if (cached !== undefined) {
      return cached;
    }
    const response = await fetch(`/api/code.json?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      return null;
    }
    const view = (await response.json()) as CodeModuleView;
    cache.set(path, view);
    return view;
  }

  async function open(link: CodeLink, fromLine: number) {
    if (link.kind === "local") {
      const definition = top().view.definitions.find((entry) => entry.symbol === link.symbol);
      if (definition !== undefined) {
        setJumpBack(fromLine);
        if (hiddenByFold(definition.startLine)) {
          setMetaFolded(false);
        }
        scrollTo(definition.startLine, true, "top");
      }
      return;
    }
    setPending(true);
    const view = await fetchModule(link.path);
    setPending(false);
    if (view === null) {
      return;
    }
    setFrames((current) => [...current, { view, symbol: link.symbol, fromLine }]);
    history.pushState({ depth: depth() }, "", syncUrl());
  }

  function back(toDepth?: number) {
    const target = toDepth ?? depth() - 1;
    if (target < 0 || target >= depth()) {
      return;
    }
    const popped = frames()[target + 1];
    setFrames((current) => current.slice(0, target + 1));
    history.replaceState({ depth: depth() }, "", syncUrl());
    const returnLine = popped?.fromLine ?? null;
    if (returnLine !== null) {
      queueMicrotask(() => scrollTo(returnLine, true));
    }
  }

  // Every new frame: reset the reading state and scroll to the opened function.
  createEffect(
    on(
      () => top().view.path + (top().symbol ?? ""),
      () => {
        setActiveNote(null);
        setJumpBack(null);
        setWholeFile(false);
        setMetaFolded(true);
        const definition = focused();
        queueMicrotask(() => {
          if (definition === null) {
            codeRegion()?.scrollTo({ top: 0 });
          } else {
            scrollTo(definition.startLine, false, "top");
          }
        });
      },
      { defer: true },
    ),
  );

  onMount(() => {
    const definition = focused();
    if (definition !== null) {
      scrollTo(definition.startLine, false, "top");
    }
    history.replaceState({ depth: depth() }, "", syncUrl());
    const onPop = (event: PopStateEvent) => {
      const wanted = (event.state as { depth?: number } | null)?.depth ?? 0;
      if (wanted < depth()) {
        setFrames((current) => current.slice(0, wanted + 1));
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select") !== null) {
        return;
      }
      const isBackKey = event.key === "Escape" || (event.altKey && event.key === "ArrowLeft");
      if (!isBackKey) {
        return;
      }
      // A jump inside the file is undone first; then the key leaves the opened file.
      const returnLine = jumpBack();
      if (returnLine !== null) {
        event.preventDefault();
        scrollTo(returnLine, true);
        setJumpBack(null);
      } else if (depth() > 0) {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      clearTimeout(flashTimer);
    });
  });

  function selectNote(index: number) {
    const note = top().view.notes.find((entry) => entry.index === index);
    if (note === undefined) {
      return;
    }
    setActiveNote(index);
    if (isDimmed(note.line)) {
      setWholeFile(true);
    }
    if (hiddenByFold(note.line)) {
      setMetaFolded(false);
    }
    scrollTo(note.line, false);
    document.getElementById(`note-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  const composesHere = () => top().view.path === props.root.path && props.compositionLine !== null;

  return (
    <section class="card overflow-hidden" aria-label="Code explorer">
      <div class="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-3.5 py-2">
        <nav
          aria-label="Where you are in the code"
          class="flex min-w-0 flex-wrap items-center gap-1"
          data-tour="crumbs"
        >
          <For each={frames()}>
            {(frame, index) => (
              <>
                <Show when={index() > 0}>
                  <span class="text-ink-5" aria-hidden="true">
                    ›
                  </span>
                </Show>
                <button
                  type="button"
                  class="crumb"
                  classList={{ "crumb-current": index() === depth() }}
                  aria-current={index() === depth() ? "location" : undefined}
                  disabled={index() === depth()}
                  onClick={() => back(index())}
                >
                  <Show when={frame.symbol} fallback={<span>{props.rootLabel}</span>}>
                    {(symbol) => (
                      <>
                        <span>{symbol()}</span>
                        <span class="text-ink-4">{` · ${frame.view.fileName}`}</span>
                      </>
                    )}
                  </Show>
                </button>
              </>
            )}
          </For>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <Show when={jumpBack()}>
            {(line) => (
              <button
                type="button"
                class="btn-ghost h-[30px] px-2.5 text-xs"
                onClick={() => {
                  scrollTo(line(), true);
                  setJumpBack(null);
                }}
              >
                ↩ Back to line {line()}
              </button>
            )}
          </Show>
          <button
            type="button"
            class="btn-ghost h-[30px] px-2.5 text-xs"
            disabled={depth() === 0}
            classList={{ "opacity-40": depth() === 0 }}
            onClick={() => back()}
            title="Back to the file you came from (Escape)"
          >
            ← Back
            <kbd class="rounded border border-rule-2 bg-surface px-1 font-mono text-[10px] text-ink-3">
              Esc
            </kbd>
          </button>
        </div>
      </div>

      <div class="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="min-w-0 border-rule xl:border-r">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule-soft px-3.5 py-2.5">
            <span class="font-mono text-[12.5px] text-ink-2">{top().view.path}</span>
            <span class="font-mono text-xs text-ink-4">{top().view.lineCount} lines</span>
            <Show when={focused()}>
              {(definition) => (
                <span class="text-xs text-ink-3">
                  Showing <span class="font-mono text-ink">{definition().symbol}</span>, lines{" "}
                  {definition().startLine}–{definition().endLine}.{" "}
                  <button
                    type="button"
                    class="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-semibold text-amber-deep underline-offset-2 hover:underline"
                    onClick={() => setWholeFile((value) => !value)}
                  >
                    {wholeFile() ? "Focus on this function" : "Show the whole file"}
                  </button>
                </span>
              )}
            </Show>
            <span class="tag tag-ok ml-auto">same module the pipeline ran</span>
          </div>
          <Show when={top().view.summary}>
            {(summary) => (
              <p class="m-0 border-b border-rule-soft bg-surface-warm px-3.5 py-2 font-serif text-[14.5px] leading-snug text-ink">
                <Terms text={summary()} />
              </p>
            )}
          </Show>
          <section
            ref={setCodeRegion}
            tabindex="0"
            data-tour="source"
            aria-label={`Source of ${top().view.path}`}
            class="relative max-h-[46rem] overflow-auto py-2 font-mono text-[12.5px] leading-[1.65] transition-opacity"
            classList={{ "opacity-60": pending() }}
          >
            <For each={top().view.lines}>
              {(line) => (
                <>
                  <Show when={metaRange()?.startLine === line.number ? metaRange() : null}>
                    {(range) => (
                      <button
                        type="button"
                        class="grid w-full cursor-pointer grid-cols-[44px_22px_1fr] items-center border-0 bg-transparent p-0 text-left font-mono text-[12px] text-ink-3 hover:bg-paper"
                        aria-expanded={!metaFolded()}
                        onClick={() => setMetaFolded((value) => !value)}
                      >
                        <span class="select-none pr-2 text-right text-ink-5" aria-hidden="true">
                          {metaFolded() ? `${range().startLine}–${range().endLine}` : ""}
                        </span>
                        <span class="text-center text-ink-4" aria-hidden="true">
                          {metaFolded() ? "▸" : "▾"}
                        </span>
                        <span class="italic">
                          {metaFolded()
                            ? `${range().endLine - range().startLine + 1} lines of level metadata (id, label, guided examples) folded. Show`
                            : "level metadata. Hide"}
                        </span>
                      </button>
                    )}
                  </Show>
                  <Show when={!hiddenByFold(line.number)}>
                    <CodeRow
                      line={line}
                      dimmed={isDimmed(line.number)}
                      composition={composesHere() && line.number === props.compositionLine}
                      definitionStart={focused()?.startLine === line.number}
                      flashing={flashLine() === line.number}
                      activeNote={line.noteIndex !== null && activeNote() === line.noteIndex}
                      onOpen={(link) => void open(link, line.number)}
                      onNote={(index) => selectNote(index)}
                    />
                  </Show>
                </>
              )}
            </For>
          </section>
          <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-rule-soft px-3.5 py-2 text-[11.5px] text-ink-3">
            <span class="inline-flex items-center gap-1.5">
              <span class="note-badge" aria-hidden="true">
                1
              </span>
              a numbered note, explained on the right
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="code-link" aria-hidden="true">
                function
              </span>
              a function you can open here
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="code-link code-link-local" aria-hidden="true">
                helper
              </span>
              defined further down in this file
            </span>
            <Show when={composesHere()}>
              <span class="inline-flex items-center gap-1.5">
                <span class="inline-block h-2.5 w-2.5 rounded-sm bg-amber" aria-hidden="true" />
                where {props.composesLabel ?? "the level below"} joins
              </span>
            </Show>
          </div>
        </div>

        <aside
          class="flex min-w-0 flex-col gap-3 px-3.5 py-3 xl:max-h-[56rem] xl:overflow-auto"
          data-tour="notes"
        >
          <div class="flex items-baseline justify-between">
            <h2 class="h2">What the numbered lines do</h2>
            <span class="text-[11.5px] text-ink-4">{top().view.notes.length} notes</span>
          </div>
          <Show
            when={top().view.notes.length > 0}
            fallback={
              <p class="note m-0">
                This helper has no notes. Read it top to bottom; the summary above the code says
                what it does. Press Back to return.
              </p>
            }
          >
            <ol class="m-0 flex list-none flex-col gap-1.5 p-0">
              <For each={top().view.notes}>
                {(note) => (
                  <li id={`note-${note.index}`}>
                    <button
                      type="button"
                      class="grid w-full cursor-pointer grid-cols-[22px_1fr] gap-x-2.5 rounded-lg border px-2 py-2 text-left font-sans text-ink"
                      classList={{
                        "border-amber-border bg-amber-tint": activeNote() === note.index,
                        "border-transparent bg-transparent hover:bg-paper":
                          activeNote() !== note.index,
                      }}
                      aria-pressed={activeNote() === note.index}
                      onClick={() => selectNote(note.index)}
                    >
                      <span class="note-badge mt-0.5" aria-hidden="true">
                        {note.index}
                      </span>
                      <span class="min-w-0">
                        <span class="block text-[13px] font-semibold leading-snug">
                          {note.title}
                          <span class="ml-1.5 font-mono text-[10.5px] font-normal text-ink-4">
                            L{note.line}
                          </span>
                        </span>
                        <span class="mt-0.5 block font-serif text-[14px] leading-snug text-ink-2">
                          <Terms text={note.text} />
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ol>
          </Show>
          <Show when={top().view.calls.length > 0}>
            <div class="border-t border-rule-soft pt-3">
              <div class="eyebrow mb-1.5">Functions this file calls</div>
              <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0">
                <For each={top().view.calls}>
                  {(call) => (
                    <li>
                      <button
                        type="button"
                        class="chip cursor-pointer border border-rule bg-surface hover:bg-blue-soft"
                        title={`Open ${call.symbol} in ${call.fileName} (first used on line ${call.line})`}
                        onClick={() =>
                          void open(
                            { path: call.path, symbol: call.symbol, kind: "module" },
                            call.line,
                          )
                        }
                      >
                        {call.symbol}
                        <span class="text-ink-4"> · {call.fileName}</span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
        </aside>
      </div>
    </section>
  );
}
