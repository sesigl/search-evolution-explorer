/**
 * Guided tours: a short sequence of spotlights over the real page. A step names the element it
 * points at by its `data-tour` value; a step without a target is a plain card in the centre.
 * Some steps carry an action that runs a real query, so the reader sees the behaviour the
 * step talks about instead of reading about it.
 */
export interface TourRun {
  readonly query: string;
  readonly levelId: string;
  readonly levers: { stemming: boolean; synonyms: boolean; variants: boolean };
}

interface TourStep {
  /** `data-tour` value of the element to highlight, or null for a centred card. */
  readonly target: string | null;
  readonly title: string;
  readonly text: string;
  /** Preferred side of the target for the card; the tour picks another side when it does not fit. */
  readonly side?: "right" | "left" | "bottom" | "top";
  /** A button in the card that runs this query on the page, then moves to the next step. */
  readonly action?: { readonly label: string; readonly run: TourRun };
}

export interface Tour {
  readonly name: string;
  readonly steps: readonly TourStep[];
  /** Label of the last button, which closes the tour. */
  readonly finishLabel: string;
}

const LEVEL_1 = "level-1-recency";

export const SEARCH_TOUR: Tour = {
  name: "search",
  finishLabel: "Start chapter 1",
  steps: [
    {
      target: null,
      title: "Hello. This is a book you can run.",
      text: "Each chapter is a small search engine, and each one fixes one weakness of the chapter before it. This tour shows the four places on this page you will use. It starts at chapter 1, so starting it switches your chapter there. It takes about two minutes, and you can leave at any step.",
    },
    {
      target: "ladder",
      side: "right",
      title: "The chapters",
      text: "This list is the book. The introduction explains how a search is graded; then chapter 1 is the simplest search that works. Click a chapter and the list is re-ranked by that chapter's engine.",
    },
    {
      target: "query",
      side: "bottom",
      title: "Ask like a buyer",
      text: "Type what a person would type into a marketplace, then press Search. Let us run one query now, with one switch off, to see the simplest search fail.",
      action: {
        label: "Run “carpet” with synonyms off",
        run: {
          query: "carpet",
          levelId: LEVEL_1,
          levers: { stemming: true, synonyms: false, variants: true },
        },
      },
    },
    {
      target: "results",
      side: "right",
      title: "Almost nothing found",
      text: "The engine looked for the exact word “carpet”. It found the listings that contain it, and it missed the sellers who wrote “rug” instead. Same product, different word: this is the first weakness of the simplest search.",
    },
    {
      target: "switches",
      side: "bottom",
      title: "Chapter 1 has no switches",
      text: "At chapter 1 the words are looked up exactly as typed, so there is nothing to switch. Chapter 2 adds three switches that change the words the engine looks up before it searches. Let us run the same query there, with all three on: synonym expansion adds “rug” to “carpet”, and variant collapsing joins “mid century” and “midcentury”. Watch the list grow.",
      action: {
        label: "Run “carpet” at chapter 2",
        run: {
          query: "carpet",
          levelId: "level-1-normalization",
          levers: { stemming: true, synonyms: true, variants: true },
        },
      },
    },
    {
      target: "lesson",
      side: "left",
      title: "Every chapter, the same four steps",
      text: "Start simple. Where it breaks. The fix. What it is called. The play buttons run each example for you, so you see the behaviour before you learn the term for it. This is the way to read the book: press, look, then read.",
    },
    {
      target: "checkpoint",
      side: "left",
      title: "Did it get better?",
      text: "Every chapter ends here. The same answer key grades this chapter and the one before it over all test queries, and gives one number each. Up means the chapter helped; down is shown too, not hidden. The introduction shows how that number is built, one row at a time.",
    },
    {
      target: "looked-for",
      side: "left",
      title: "What the engine looked for",
      text: "Your words after each switch. Blue chips were added by a switch; every added word lets more listings match. Any word with a dotted underline on this site has a definition: hover it or tap it.",
    },
    {
      target: "code",
      side: "left",
      title: "Then read the code that ran",
      text: "Every chapter ends in its own source code, with numbered notes beside the lines that matter. Functions open in place, and Back returns you to the line you left. That is the tour. Now follow step 1 of the lesson.",
    },
  ],
};

export const BIAS_TOUR: Tour = {
  name: "bias",
  finishLabel: "Try the lab",
  steps: [
    {
      target: null,
      title: "The trap under learned ranking",
      text: "A model can only learn from what searchers did. Searchers mostly click the top of the page, so raw clicks teach the model where things were shown, not how good they were. This tour shows the four parts of that lesson on this page.",
    },
    {
      target: "bias-metrics",
      side: "bottom",
      title: "One log, two models",
      text: "Both models learn from the same click log. The naive model treats every click as a vote. The corrected model divides each click by how likely that position was to be seen. The gap between the two is the whole lesson: small here on purpose, because the teaching queries are easy.",
    },
    {
      target: "bias-chart",
      side: "right",
      title: "Why a click low down counts more",
      text: "The curve shows how likely each position was to be examined. Position 1 is seen by almost everyone, position 10 by few. One click at position 10 is therefore stronger evidence than one at the top.",
    },
    {
      target: "bias-lab",
      side: "top",
      title: "Now run both models yourself",
      text: "Pick a query, then switch between the raw-click sort and the weighted sort. The grade-0 listings the naive model promoted fall down. That is the bias, listing by listing.",
    },
  ],
};

export const CODE_TOUR: Tour = {
  name: "code",
  finishLabel: "Read the code",
  steps: [
    {
      target: null,
      title: "This is the code that ran your query",
      text: "Nothing here was simplified for display. The file is read from disk. Three short steps show how to read it.",
    },
    {
      target: "notes",
      side: "left",
      title: "Follow the numbers",
      text: "Each numbered badge marks a line that matters. The panel explains what the line does, why it matters, and what the idea is called. Click a badge or a note, and the other side scrolls to it.",
    },
    {
      target: "source",
      side: "right",
      title: "Open any function",
      text: "A word with a dotted blue underline is a function this file calls. Click it: the function opens here, focused, with the rest of its file dimmed. A grey underline is a helper further down in the same file.",
    },
    {
      target: "crumbs",
      side: "bottom",
      title: "Come back",
      text: "This trail shows where you are. Back, the Escape key, or a click on any crumb returns you to the line you left, and that line flashes. The address bar follows you, so you can share any spot in the code.",
    },
  ],
};

export function tourNamed(name: string): Tour | undefined {
  return [SEARCH_TOUR, CODE_TOUR, BIAS_TOUR].find((tour) => tour.name === name);
}
