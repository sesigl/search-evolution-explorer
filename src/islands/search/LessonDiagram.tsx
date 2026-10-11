import { For, Match, Switch } from "solid-js";

/**
 * A small picture for the ideas that are hard to hold in words alone. Shown inside the lesson
 * card, under the four steps, for the chapters that have one. The diagrams are decorative:
 * every one repeats a point the text already makes, so nothing is lost without them.
 */
export default function LessonDiagram(props: { levelId: string }) {
  return (
    <Switch fallback={null}>
      <Match when={props.levelId === "level-1-lexical"}>
        <InvertedIndexDiagram />
      </Match>
      <Match when={props.levelId === "level-4-hybrid"}>
        <VectorDiagram />
      </Match>
      <Match when={props.levelId === "level-5-cross-encoder"}>
        <CascadeDiagram />
      </Match>
    </Switch>
  );
}

const INDEX_ROWS = [
  { label: '"sofa"', listings: "listing 12 · 88", y: 22 },
  { label: '"couch"', listings: "listing 88 · 91", y: 56 },
  { label: '"bike"', listings: "listing 40 · 41", y: 90 },
] as const;

/** One table, built ahead of time: a word points at the listings that contain it. */
function InvertedIndexDiagram() {
  return (
    <figure class="m-0 rounded-lg border border-rule-soft bg-surface px-3 py-2.5">
      <svg
        viewBox="0 0 320 112"
        class="block w-full"
        role="img"
        aria-label="A word table: each word points at the listings that contain it"
      >
        <For each={INDEX_ROWS}>
          {(row) => (
            <g>
              <text
                x="4"
                y={row.y}
                font-size="11.5"
                font-family="IBM Plex Mono, Menlo, monospace"
                fill="#26211b"
              >
                {row.label}
              </text>
              <line
                x1="62"
                y1={row.y - 4}
                x2="130"
                y2={row.y - 4}
                stroke="#b3641e"
                stroke-width="1.3"
              />
              <polygon
                points={`130,${row.y - 7.5} 136,${row.y - 4} 130,${row.y - 0.5}`}
                fill="#b3641e"
              />
              <text
                x="142"
                y={row.y}
                font-size="11"
                font-family="IBM Plex Mono, Menlo, monospace"
                fill="#0e7c9c"
              >
                {row.listings}
              </text>
            </g>
          )}
        </For>
        <text x="4" y="108" font-size="10.5" font-family="IBM Plex Sans, sans-serif" fill="#8b8073">
          word → the listings that contain it
        </text>
      </svg>
    </figure>
  );
}

/** Two arrows from the same point. The smaller the angle, the more the two texts mean alike. */
function VectorDiagram() {
  return (
    <figure class="m-0 rounded-lg border border-rule-soft bg-surface px-3 py-2.5">
      <svg
        viewBox="0 0 320 138"
        class="block w-full"
        role="img"
        aria-label="Two vectors from one point, with a small angle labelled cosine similarity"
      >
        <line x1="24" y1="110" x2="312" y2="110" stroke="#cfc5b4" stroke-width="1" />
        <line x1="24" y1="110" x2="24" y2="10" stroke="#cfc5b4" stroke-width="1" />
        <line x1="24" y1="110" x2="244" y2="36" stroke="#0e7c9c" stroke-width="2" />
        <polygon points="252,34 244.8,40.6 242.2,33.0" fill="#0e7c9c" />
        <line x1="24" y1="110" x2="230" y2="68" stroke="#b3641e" stroke-width="2" />
        <polygon points="238,66 230,71.7 228.4,63.9" fill="#b3641e" />
        <path d="M 100 82 A 88 88 0 0 0 92 68" fill="none" stroke="#8b8073" stroke-width="1.2" />
        <text
          x="108"
          y="70"
          font-size="10.5"
          font-family="IBM Plex Sans, sans-serif"
          fill="#26211b"
        >
          cosine similarity
        </text>
        <text x="256" y="32" font-size="11" font-family="IBM Plex Sans, sans-serif" fill="#0e7c9c">
          query
        </text>
        <text x="242" y="72" font-size="11" font-family="IBM Plex Sans, sans-serif" fill="#b3641e">
          listing
        </text>
        <text
          x="24"
          y="130"
          font-size="10.5"
          font-family="IBM Plex Sans, sans-serif"
          fill="#8b8073"
        >
          a small angle between the arrows means a close match in meaning
        </text>
      </svg>
    </figure>
  );
}

/** The rerank cascade: a short list is produced first, then scored one pair at a time. */
function CascadeDiagram() {
  return (
    <figure class="m-0 rounded-lg border border-rule-soft bg-surface px-3 py-2.5">
      <svg
        viewBox="0 0 320 96"
        class="block w-full"
        role="img"
        aria-label="Chapters 1 to 4 retrieve a short list, the cross-encoder scores each query-listing pair, the top 10 is shown"
      >
        <g font-family="IBM Plex Sans, sans-serif" font-size="10.5" fill="#26211b">
          <rect x="4" y="26" width="86" height="42" rx="7" fill="#f4efe6" stroke="#cfc5b4" />
          <text x="47" y="44" text-anchor="middle">
            chapters 1–4
          </text>
          <text x="47" y="58" text-anchor="middle" fill="#8b8073">
            short list
          </text>

          <rect x="118" y="26" width="86" height="42" rx="7" fill="#f4efe6" stroke="#cfc5b4" />
          <text x="161" y="44" text-anchor="middle">
            cross-encoder
          </text>
          <text x="161" y="58" text-anchor="middle" fill="#8b8073">
            one pair at a time
          </text>

          <rect x="232" y="26" width="84" height="42" rx="7" fill="#f4efe6" stroke="#cfc5b4" />
          <text x="274" y="44" text-anchor="middle">
            top 10
          </text>
          <text x="274" y="58" text-anchor="middle" fill="#8b8073">
            shown
          </text>
        </g>
        <line x1="92" y1="47" x2="112" y2="47" stroke="#8b8073" stroke-width="1.3" />
        <polygon points="112,43.5 118,47 112,50.5" fill="#8b8073" />
        <line x1="206" y1="47" x2="226" y2="47" stroke="#8b8073" stroke-width="1.3" />
        <polygon points="226,43.5 232,47 226,50.5" fill="#8b8073" />
        <text x="4" y="88" font-size="10.5" font-family="IBM Plex Sans, sans-serif" fill="#8b8073">
          scoring every pair over the whole corpus would be far too slow
        </text>
      </svg>
    </figure>
  );
}
