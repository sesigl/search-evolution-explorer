import { For, Show } from "solid-js";
import { splitTerms } from "../../content/glossary.ts";

/**
 * Renders prose and attaches the glossary definition to the first occurrence of every term,
 * as a dotted underline with a popover on hover or focus. The trigger is an inline span, not
 * a button, so the word wraps like text and keeps its trailing punctuation.
 */
export default function Terms(props: { text: string }) {
  const segments = () => splitTerms(props.text);
  return (
    <For each={segments()}>
      {(segment) => (
        <Show when={segment.definition} fallback={<>{segment.text}</>}>
          {(definition) => (
            <span class="term">
              <span class="term-word" tabindex="0">
                {segment.text}
              </span>
              <span role="tooltip">{definition()}</span>
            </span>
          )}
        </Show>
      )}
    </For>
  );
}
