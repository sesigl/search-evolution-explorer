import type { VariantRule } from "../types/query.ts";

export function normalizeVariants(
  tokens: readonly string[],
  rules: readonly VariantRule[],
): string[] {
  const joined = tokens.join(" ");
  let normalized = joined;
  for (const rule of rules) {
    normalized = normalized.replaceAll(rule.pattern, rule.canonical);
  }
  return normalized.split(" ").filter((token) => token !== "");
}
