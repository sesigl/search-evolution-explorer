import { For, Show } from "solid-js";
import type { CodeLine, CodeLink } from "../../actions/get-code-module.ts";

interface Props {
  line: CodeLine;
  dimmed: boolean;
  composition: boolean;
  definitionStart: boolean;
  flashing: boolean;
  activeNote: boolean;
  onOpen: (link: CodeLink) => void;
  onNote: (index: number) => void;
}

/** One source line: gutter number, optional note badge, and the text with openable symbols. */
export default function CodeRow(props: Props) {
  return (
    <div
      class="grid grid-cols-[44px_22px_1fr] items-start transition-opacity duration-300"
      classList={{
        "opacity-35": props.dimmed,
        "bg-amber-tint shadow-[inset_3px_0_0_#b3641e]": props.composition,
        "bg-blue-soft/60 shadow-[inset_3px_0_0_#0e7c9c]": props.definitionStart,
        "code-flash": props.flashing,
        "bg-paper-2": props.activeNote && !props.composition,
      }}
      data-line={props.line.number}
    >
      <span
        class="select-none pr-2 text-right text-ink-5"
        classList={{ "text-amber-deep": props.composition }}
        aria-hidden="true"
      >
        {props.line.number}
      </span>
      <span class="flex justify-center pt-[3px]">
        <Show when={props.line.noteIndex}>
          {(index) => (
            <button
              type="button"
              class="note-badge cursor-pointer border-0"
              title={`Note ${index()}`}
              aria-label={`Show note ${index()} for line ${props.line.number}`}
              onClick={() => props.onNote(index())}
            >
              {index()}
            </button>
          )}
        </Show>
      </span>
      <code class="whitespace-pre-wrap break-words pr-4">
        <For each={props.line.spans}>
          {(span) => (
            <Show when={span.link} fallback={span.text}>
              {(link) => (
                <button
                  type="button"
                  class="code-link"
                  classList={{ "code-link-local": link().kind === "local" }}
                  title={
                    link().kind === "local"
                      ? `Jump to ${link().symbol} in this file`
                      : `Open ${link().symbol} in ${fileNameOf(link().path)}`
                  }
                  onClick={() => props.onOpen(link())}
                >
                  {span.text}
                </button>
              )}
            </Show>
          )}
        </For>
      </code>
    </div>
  );
}

function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
