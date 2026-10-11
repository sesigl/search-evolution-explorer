import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { type Node, Project, SyntaxKind } from "ts-morph";
import { CRAP_THRESHOLD, computeCrap, isAboveCrapThreshold } from "./crap-score.ts";

interface StatementSpan {
  start: { line: number };
}

interface IstanbulFile {
  statementMap: Record<string, StatementSpan>;
  s: Record<string, number>;
}

type IstanbulJson = Record<string, IstanbulFile>;

interface FunctionScore {
  file: string;
  name: string;
  complexity: number;
  coverage: number;
  crap: number;
}

function isFunctionLike(node: Node): boolean {
  const kind = node.getKind();
  return (
    kind === SyntaxKind.FunctionDeclaration ||
    kind === SyntaxKind.FunctionExpression ||
    kind === SyntaxKind.ArrowFunction ||
    kind === SyntaxKind.MethodDeclaration
  );
}

function cyclomaticComplexity(fn: Node): number {
  let complexity = 1;
  fn.forEachDescendant((node, traversal) => {
    if (isFunctionLike(node) && node !== fn) {
      traversal.skip();
      return;
    }
    switch (node.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CaseClause:
      case SyntaxKind.CatchClause:
      case SyntaxKind.ConditionalExpression:
        complexity += 1;
        break;
      case SyntaxKind.BinaryExpression: {
        const operator = node
          .asKindOrThrow(SyntaxKind.BinaryExpression)
          .getOperatorToken()
          .getKind();
        if (
          operator === SyntaxKind.AmpersandAmpersandToken ||
          operator === SyntaxKind.BarBarToken ||
          operator === SyntaxKind.QuestionQuestionToken
        ) {
          complexity += 1;
        }
        break;
      }
      default:
        break;
    }
  });
  return complexity;
}

function functionName(fn: Node): string {
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return fn.asKindOrThrow(SyntaxKind.FunctionDeclaration).getName() ?? "<anonymous>";
  }
  if (fn.getKind() === SyntaxKind.MethodDeclaration) {
    return fn.asKindOrThrow(SyntaxKind.MethodDeclaration).getName();
  }
  return "<anonymous>";
}

function statementCoverage(fileCov: IstanbulFile, startLine: number, endLine: number): number {
  let total = 0;
  let covered = 0;
  for (const [id, loc] of Object.entries(fileCov.statementMap)) {
    if (loc.start.line >= startLine && loc.start.line <= endLine) {
      total += 1;
      const hits = fileCov.s[id] ?? 0;
      if (hits > 0) {
        covered += 1;
      }
    }
  }
  if (total === 0) {
    return 1;
  }
  return covered / total;
}

function coverageForFile(coverage: IstanbulJson, filePath: string): IstanbulFile | undefined {
  const direct = coverage[filePath];
  if (direct) {
    return direct;
  }
  const suffix = Object.keys(coverage).find(
    (key) => key.endsWith(filePath) || filePath.endsWith(key),
  );
  if (suffix === undefined) {
    return undefined;
  }
  return coverage[suffix];
}

function scoreProject(coverage: IstanbulJson, tsconfigPath: string): FunctionScore[] {
  const project = new Project({ tsConfigFilePath: tsconfigPath });
  const scores: FunctionScore[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const inScope = filePath.includes("/src/domain/") || filePath.includes("/src/actions/");
    const skip = !inScope || filePath.endsWith(".spec.ts") || filePath.includes("node_modules");
    if (!skip) {
      const fileCov = coverageForFile(coverage, filePath);
      sourceFile.forEachDescendant((node) => {
        if (isFunctionLike(node)) {
          const start = node.getStartLineNumber();
          const end = node.getEndLineNumber();
          const complexity = cyclomaticComplexity(node);
          let coverageRatio = 0;
          if (fileCov !== undefined) {
            coverageRatio = statementCoverage(fileCov, start, end);
          }
          scores.push({
            file: filePath,
            name: functionName(node),
            complexity,
            coverage: coverageRatio,
            crap: computeCrap(complexity, coverageRatio),
          });
        }
      });
    }
  }
  return scores;
}

function main(): void {
  const coveragePath = resolve("coverage/coverage-final.json");
  let coverage: IstanbulJson;
  try {
    coverage = JSON.parse(readFileSync(coveragePath, "utf8")) as IstanbulJson;
  } catch {
    process.stderr.write(`CRAP check cannot read coverage JSON at ${coveragePath}\n`);
    process.exit(1);
    return;
  }
  const scores = scoreProject(coverage, resolve("tsconfig.json"));
  const offenders = scores.filter((score) => isAboveCrapThreshold(score.crap));
  const percent = 100;
  const crapDecimals = 2;
  const coverageDecimals = 1;
  for (const score of offenders) {
    process.stderr.write(
      `${score.file} ${score.name}: CRAP ${score.crap.toFixed(crapDecimals)} (complexity ${score.complexity}, coverage ${(score.coverage * percent).toFixed(coverageDecimals)}%)\n`,
    );
  }
  if (offenders.length > 0) {
    process.stderr.write(
      `CRAP threshold ${CRAP_THRESHOLD} exceeded by ${offenders.length} function(s)\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`CRAP check passed for ${scores.length} function(s)\n`);
}

const [, invokedPath] = process.argv;
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
