import { dirnameOf, resolvePath } from "./module-registry.ts";

export interface CodeLink {
  /** Module that holds the definition. Equals the current module for a local jump. */
  readonly path: string;
  /** Exported name in that module (the import alias is resolved). */
  readonly symbol: string;
  readonly kind: "module" | "local";
}

interface CodeSpan {
  readonly text: string;
  readonly link: CodeLink | null;
}

export interface CodeLine {
  readonly number: number;
  readonly spans: readonly CodeSpan[];
  /** 1-based number of the note attached to this line, if any. */
  readonly noteIndex: number | null;
}

interface CodeNoteView {
  readonly index: number;
  readonly line: number;
  readonly title: string;
  readonly text: string;
}

export interface CodeDefinition {
  readonly symbol: string;
  readonly startLine: number;
  readonly endLine: number;
}

interface CodeCall {
  readonly symbol: string;
  readonly path: string;
  readonly fileName: string;
  readonly line: number;
}

export interface CodeModuleView {
  readonly path: string;
  readonly fileName: string;
  readonly summary: string | null;
  readonly lineCount: number;
  readonly lines: readonly CodeLine[];
  readonly notes: readonly CodeNoteView[];
  readonly definitions: readonly CodeDefinition[];
  /** Imported functions and constants this module uses, each with the line of first use. */
  readonly calls: readonly CodeCall[];
}

/** One authored callout: `at` is a substring that identifies exactly one line of the module. */
interface CodeNote {
  readonly at: string;
  readonly title: string;
  readonly text: string;
}

export interface CodeNotes {
  readonly summary: string;
  readonly notes: readonly CodeNote[];
}

interface ImportedSymbol {
  readonly localName: string;
  readonly link: CodeLink;
}

const IMPORT_STATEMENT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
const FUNCTION_DEFINITION = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const CONST_DEFINITION = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*[:=]/;
const IMPORT_LINE = /^import\s/;
const IMPORT_ALIAS = /\s+as\s+/;
const OPENERS = new Set(["{", "(", "["]);
const CLOSERS = new Set(["}", ")", "]"]);
const TRAILING_NEWLINE = /\n$/;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

export function explainModule(
  path: string,
  source: string,
  notes: CodeNotes | undefined,
  knownPaths: ReadonlySet<string>,
): CodeModuleView {
  const lines = source.replace(TRAILING_NEWLINE, "").split("\n");
  const imports = parseImports(source, path, knownPaths);
  const definitions = findDefinitions(lines);
  const noteViews = resolveNotes(path, lines, notes?.notes ?? []);
  const noteIndexByLine = new Map(noteViews.map((note) => [note.line, note.index]));
  const linkByName = new Map<string, CodeLink>();
  for (const definition of definitions) {
    linkByName.set(definition.symbol, { path, symbol: definition.symbol, kind: "local" });
  }
  for (const imported of imports) {
    linkByName.set(imported.localName, imported.link);
  }
  const definitionLineOf = new Map(definitions.map((entry) => [entry.symbol, entry.startLine]));
  const matcher = matcherFor([...linkByName.keys()]);

  const codeLines = lines.map((text, index) => {
    const number = index + 1;
    return {
      number,
      spans: splitSpans(text, matcher, (name) => {
        const link = linkByName.get(name);
        if (link === undefined || definitionLineOf.get(name) === number) {
          return null;
        }
        return link;
      }),
      noteIndex: noteIndexByLine.get(number) ?? null,
    };
  });

  return {
    path,
    fileName: fileNameOf(path),
    summary: notes?.summary ?? null,
    lineCount: lines.length,
    lines: codeLines,
    notes: noteViews,
    definitions,
    calls: firstUses(codeLines, imports),
  };
}

function parseImports(
  source: string,
  path: string,
  knownPaths: ReadonlySet<string>,
): ImportedSymbol[] {
  const result: ImportedSymbol[] = [];
  for (const match of source.matchAll(IMPORT_STATEMENT)) {
    const [, typeOnly, names, specifier] = match;
    if (typeOnly !== undefined || names === undefined || specifier === undefined) {
      continue;
    }
    const target = resolvePath(dirnameOf(path), specifier);
    if (knownPaths.has(target) && target !== path) {
      result.push(...importedNames(names, target));
    }
  }
  return result;
}

/** `{ a, b as c, type D }` becomes a and b (as c); type-only names are not openable. */
function importedNames(names: string, target: string): ImportedSymbol[] {
  return names
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "" && !entry.startsWith("type "))
    .flatMap((entry) => {
      const [symbol, alias] = entry.split(IMPORT_ALIAS);
      return symbol === undefined
        ? []
        : [{ localName: alias ?? symbol, link: { path: target, symbol, kind: "module" as const } }];
    });
}

function findDefinitions(lines: readonly string[]): CodeDefinition[] {
  const definitions: CodeDefinition[] = [];
  for (const [index, text] of lines.entries()) {
    const symbol = FUNCTION_DEFINITION.exec(text)?.[1] ?? CONST_DEFINITION.exec(text)?.[1];
    if (symbol !== undefined) {
      definitions.push({
        symbol,
        startLine: index + 1,
        endLine: blockEnd(lines, index) + 1,
      });
    }
  }
  return definitions;
}

/** Index of the line that closes the block opened on `startIndex`; the start line itself when no block opens. */
function blockEnd(lines: readonly string[], startIndex: number): number {
  let depth = 0;
  let opened = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    const text = lines[index] ?? "";
    const { opens, closes } = bracketCounts(text);
    opened = opened || opens > 0;
    depth += opens - closes;
    const closesBlock = opened && depth <= 0;
    const singleStatement = !opened && text.trimEnd().endsWith(";");
    if (closesBlock || singleStatement) {
      return index;
    }
  }
  return lines.length - 1;
}

function bracketCounts(text: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  for (const character of text) {
    opens += OPENERS.has(character) ? 1 : 0;
    closes += CLOSERS.has(character) ? 1 : 0;
  }
  return { opens, closes };
}

function resolveNotes(
  path: string,
  lines: readonly string[],
  notes: readonly CodeNote[],
): CodeNoteView[] {
  const placed = notes.map((note) => {
    const hits = lines.flatMap((text, index) => (text.includes(note.at) ? [index + 1] : []));
    if (hits.length !== 1) {
      throw new Error(
        `Code note "${note.title}" in ${path} must match exactly one line, matched ${hits.length}: ${note.at}`,
      );
    }
    return { line: hits[0] ?? 0, title: note.title, text: note.text };
  });
  placed.sort((left, right) => left.line - right.line);
  return placed.map((note, index) => ({ ...note, index: index + 1 }));
}

function matcherFor(names: readonly string[]): RegExp | null {
  if (names.length === 0) {
    return null;
  }
  const escaped = names.map((name) => name.replace(REGEX_SPECIALS, "\\$&"));
  return new RegExp(`(?<![.\\w$])(${escaped.join("|")})(?![\\w$])`, "g");
}

function splitSpans(
  text: string,
  matcher: RegExp | null,
  linkFor: (name: string) => CodeLink | null,
): CodeSpan[] {
  if (matcher === null) {
    return [{ text, link: null }];
  }
  const spans: CodeSpan[] = [];
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const name = match[1];
    const start = match.index;
    if (name === undefined) {
      continue;
    }
    const link = linkFor(name);
    if (link === null) {
      continue;
    }
    if (start > cursor) {
      spans.push({ text: text.slice(cursor, start), link: null });
    }
    spans.push({ text: name, link });
    cursor = start + name.length;
  }
  if (cursor < text.length || spans.length === 0) {
    spans.push({ text: text.slice(cursor), link: null });
  }
  return spans;
}

function firstUses(lines: readonly CodeLine[], imports: readonly ImportedSymbol[]): CodeCall[] {
  const calls: CodeCall[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const firstSpan = line.spans[0]?.text ?? "";
    if (IMPORT_LINE.test(firstSpan)) {
      continue;
    }
    for (const span of line.spans) {
      const link = span.link;
      if (link === null || link.kind !== "module") {
        continue;
      }
      const key = `${link.path}#${link.symbol}`;
      if (!seen.has(key)) {
        seen.add(key);
        calls.push({
          symbol: link.symbol,
          path: link.path,
          fileName: fileNameOf(link.path),
          line: line.number,
        });
      }
    }
  }
  return imports.length === 0 ? [] : calls;
}

function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
