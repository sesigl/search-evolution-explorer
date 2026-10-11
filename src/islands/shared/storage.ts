/**
 * Reading progress and tour state live in the browser only. Every access is wrapped: a private
 * window, a blocked storage, or a server render must never break a page.
 */
const PREFIX = "see:";

export interface ReadingPlace {
  readonly levelId: string;
  readonly query: string;
  readonly href: string;
}

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Storage is a convenience; the page works without it.
  }
}

/** True once the named tour was finished or skipped in this browser. */
export function tourSeen(name: string): boolean {
  return read(`tour:${name}`) === "done";
}

export function markTourSeen(name: string): void {
  write(`tour:${name}`, "done");
}

/** Level ids the reader has opened on the search page, oldest first. */
function visitedLevels(): readonly string[] {
  const raw = read("visited");
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markVisited(levelId: string): void {
  const seen = visitedLevels();
  if (!seen.includes(levelId)) {
    write("visited", JSON.stringify([...seen, levelId]));
  }
}

/** Where the reader was last; the contents page reads it back to offer "continue". */
export function rememberPlace(place: ReadingPlace): void {
  write("place", JSON.stringify(place));
}
