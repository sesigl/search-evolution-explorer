import { For, Show } from "solid-js";
import { type Lesson, type LessonTry, STEP_TITLES } from "../../content/lessons.ts";
import LessonDiagram from "./LessonDiagram.tsx";
import Terms from "./Terms.tsx";

interface Props {
  lesson: Lesson;
  /** Chapter the lesson belongs to, so the right diagram is shown. */
  levelId: string;
  /** Server-rendered link for a try, so the lesson works before hydration. */
  href: (attempt: LessonTry) => string;
  /** Runs the try in place after hydration; return false to let the link navigate. */
  onTry: (attempt: LessonTry, event: MouseEvent) => void;
  /** Set when the result list shows another level than this lesson belongs to. */
  viewingOther: { label: string; href: string; onBack: (event: MouseEvent) => void } | null;
}

const STEP_STYLE: Record<Lesson["steps"][number]["kind"], string> = {
  naive: "bg-paper-3 text-ink-2",
  problem: "bg-red-soft text-red",
  solution: "bg-green-soft text-green",
  name: "bg-amber-soft text-amber-deep",
};

/** The four-step lesson of a level: start simple, where it breaks, the fix, what it is called. */
export default function LessonCard(props: Props) {
  return (
    <section class="card-warm flex flex-col gap-3 px-[18px] py-4" aria-label="Lesson">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="m-0 font-serif text-[19px] font-semibold leading-tight tracking-[-0.005em]">
          {props.lesson.question}
        </h2>
      </div>
      <Show when={props.viewingOther}>
        {(other) => (
          <a
            href={other().href}
            onClick={other().onBack}
            class="flex items-center justify-between gap-2 rounded-lg bg-amber-tint px-3 py-2 text-[12.5px] font-semibold text-amber-deep no-underline hover:text-amber-deep"
          >
            <span>{other().label}</span>
            <span aria-hidden="true">↩</span>
          </a>
        )}
      </Show>
      <ol class="m-0 flex list-none flex-col gap-3 p-0">
        <For each={props.lesson.steps}>
          {(step, index) => (
            <li class="grid grid-cols-[26px_1fr] gap-x-3">
              <span
                class={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11.5px] font-semibold ${STEP_STYLE[step.kind]}`}
              >
                {index() + 1}
              </span>
              <div class="min-w-0">
                <div class="eyebrow">{STEP_TITLES[step.kind]}</div>
                <p class="m-0 mt-0.5 font-serif text-[15px] leading-[1.5] text-ink">
                  <Terms text={step.text} />
                </p>
                <Show when={step.tries !== undefined && step.tries.length > 0}>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <For each={step.tries}>
                      {(attempt) => (
                        <a
                          class="btn-ghost h-[30px] px-2.5 text-xs"
                          href={props.href(attempt)}
                          onClick={(event) => props.onTry(attempt, event)}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M7 5v14l11-7z" />
                          </svg>
                          {attempt.label}
                        </a>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={step.links !== undefined && step.links.length > 0}>
                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <For each={step.links}>
                      {(link) => (
                        <a class="text-xs font-semibold" href={link.href}>
                          {link.label}
                        </a>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </li>
          )}
        </For>
      </ol>
      <LessonDiagram levelId={props.levelId} />
    </section>
  );
}
