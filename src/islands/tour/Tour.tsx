import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import type { Tour as TourContent, TourRun } from "../../content/tours.ts";
import { markTourSeen, tourSeen } from "../shared/storage.ts";
import {
  type CardPosition,
  centerCard,
  DOCK_BELOW_WIDTH,
  placeCard,
  type Rect,
  spotlightRect,
} from "./placement.ts";

interface Props {
  tour: TourContent;
  /** Open at once, for example when the page was reached through a "take the tour" link. */
  autoStart: boolean;
  /** Open on the first visit to this page in this browser. */
  startOnFirstVisit: boolean;
}

/** Event the top bar's Tour button dispatches (see BaseLayout), and the event a tour action fires. */
const TOUR_START_EVENT = "see:tour:start";
export const TOUR_RUN_EVENT = "see:run";

const ADVANCE_AFTER_ACTION_MS = 900;

/**
 * A spotlight tour over the live page. The page underneath stays usable: the overlay lets every
 * pointer event through, only the card catches clicks. Steps are read from content; actions run
 * real queries through a DOM event the search workbench listens for.
 */
export default function Tour(props: Props) {
  const [open, setOpen] = createSignal(false);
  const [index, setIndex] = createSignal(0);
  const [spot, setSpot] = createSignal<Rect | null>(null);
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });
  const [card, setCard] = createSignal<HTMLElement>();
  const [ran, setRan] = createSignal(false);
  let frame = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  const step = () => props.tour.steps[index()] ?? props.tour.steps[0];
  const count = () => props.tour.steps.length;
  const isLast = () => index() === count() - 1;
  const docked = () => viewport().width < DOCK_BELOW_WIDTH;

  function targetElement(): HTMLElement | null {
    const name = step()?.target ?? null;
    return name === null ? null : document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  }

  function measure() {
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const element = targetElement();
    if (element === null) {
      setSpot(null);
    } else {
      const rect = element.getBoundingClientRect();
      setSpot(spotlightRect(rect, { width: window.innerWidth, height: window.innerHeight }));
    }
    frame = requestAnimationFrame(measure);
  }

  function start() {
    setIndex(0);
    setRan(false);
    setOpen(true);
  }

  function close() {
    clearTimeout(advanceTimer);
    setOpen(false);
    markTourSeen(props.tour.name);
    // A `tour=1` link must not trap the reader: drop the parameter once the tour is done.
    const url = new URL(window.location.href);
    if (url.searchParams.has("tour")) {
      url.searchParams.delete("tour");
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function go(delta: number) {
    clearTimeout(advanceTimer);
    const next = index() + delta;
    if (next < 0) {
      return;
    }
    if (next >= count()) {
      close();
      // The tour ended at the bottom of the page; the reader continues at the top.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setRan(false);
    setIndex(next);
  }

  function runAction(run: TourRun) {
    document.dispatchEvent(new CustomEvent(TOUR_RUN_EVENT, { detail: run }));
    setRan(true);
    advanceTimer = setTimeout(() => go(1), ADVANCE_AFTER_ACTION_MS);
  }

  // A new step scrolls its target into view and gives the card keyboard focus.
  createEffect(
    on([open, index], () => {
      if (!open()) {
        return;
      }
      targetElement()?.scrollIntoView({ block: "center", behavior: "smooth" });
      requestAnimationFrame(() => card()?.focus({ preventScroll: true }));
    }),
  );

  createEffect(
    on(open, (isOpen) => {
      cancelAnimationFrame(frame);
      if (isOpen) {
        measure();
      }
    }),
  );

  onMount(() => {
    const onStart = () => start();
    const onKey = (event: KeyboardEvent) => {
      if (!open()) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (event.key === "ArrowRight") {
        go(1);
      } else if (event.key === "ArrowLeft") {
        go(-1);
      }
    };
    document.addEventListener(TOUR_START_EVENT, onStart);
    window.addEventListener("keydown", onKey, { capture: true });
    onCleanup(() => {
      document.removeEventListener(TOUR_START_EVENT, onStart);
      window.removeEventListener("keydown", onKey, { capture: true });
      cancelAnimationFrame(frame);
      clearTimeout(advanceTimer);
    });
    if (props.autoStart || (props.startOnFirstVisit && !tourSeen(props.tour.name))) {
      start();
    }
  });

  const position = (): CardPosition => {
    const size = { width: card()?.offsetWidth ?? 360, height: card()?.offsetHeight ?? 220 };
    const current = spot();
    if (docked()) {
      return { side: "bottom", top: viewport().height - size.height - 12, left: 12 };
    }
    return current === null
      ? centerCard(size, viewport())
      : placeCard(current, size, viewport(), step()?.side ?? "right");
  };

  return (
    <Show when={open()}>
      <div class="tour-overlay" aria-hidden="true">
        <Show when={spot()} fallback={<div class="tour-veil" />}>
          {(rect) => (
            <div
              class="tour-spot"
              style={{
                top: `${rect().top}px`,
                left: `${rect().left}px`,
                width: `${rect().width}px`,
                height: `${rect().height}px`,
              }}
            />
          )}
        </Show>
      </div>
      <section
        ref={setCard}
        tabindex="-1"
        role="dialog"
        aria-label={`Tour, step ${index() + 1} of ${count()}`}
        class="tour-card"
        classList={{ "tour-card-docked": docked() }}
        style={{ top: `${position().top}px`, left: `${position().left}px` }}
      >
        <div class="flex items-center justify-between gap-3">
          <span class="eyebrow">
            Tour · {index() + 1} of {count()}
          </span>
          <button type="button" class="tour-skip" onClick={close}>
            Skip tour <kbd>Esc</kbd>
          </button>
        </div>
        <h2 class="m-0 mt-1.5 font-serif text-[19px] font-semibold leading-tight tracking-[-0.005em]">
          {step()?.title}
        </h2>
        <p class="m-0 mt-1.5 font-serif text-[15px] leading-[1.5] text-ink-2">{step()?.text}</p>
        <Show when={step()?.action}>
          {(action) => (
            <button
              type="button"
              class="btn mt-3 h-10 self-start text-[13.5px]"
              classList={{ "opacity-60": ran() }}
              disabled={ran()}
              onClick={() => runAction(action().run)}
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
              {ran() ? "Running…" : action().label}
            </button>
          )}
        </Show>
        <div class="mt-3.5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-1" aria-hidden="true">
            <For each={props.tour.steps}>
              {(_, dot) => (
                <span class="tour-dot" classList={{ "tour-dot-on": dot() <= index() }} />
              )}
            </For>
          </div>
          <div class="flex items-center gap-1.5">
            <Show when={index() > 0}>
              <button type="button" class="btn-ghost h-9" onClick={() => go(-1)}>
                Back
              </button>
            </Show>
            <button type="button" class="btn-ghost h-9 border-ink" onClick={() => go(1)}>
              {isLast() ? props.tour.finishLabel : index() === 0 ? "Show me" : "Next"}
              <Show when={!isLast()}>
                <span aria-hidden="true">→</span>
              </Show>
            </button>
          </div>
        </div>
      </section>
    </Show>
  );
}
