export function expandSynonyms(
  tokens: readonly string[],
  synonymGroups: readonly (readonly string[])[],
): string[] {
  const expanded = [...tokens];
  for (const token of tokens) {
    for (const group of synonymGroups) {
      if (group.includes(token)) {
        for (const synonym of group) {
          if (!expanded.includes(synonym)) {
            expanded.push(synonym);
          }
        }
      }
    }
  }
  return expanded;
}
