const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Freshness halves every halfLifeDays: 1 for a listing posted at the reference instant,
 * 0.5 one half-life earlier. Unlike 1 / (1 + age), each day of age costs the same share,
 * so "how many days is a better text match worth" has one answer.
 */
export function freshnessScore(
  postedAt: string,
  referenceMs: number,
  halfLifeDays: number,
): number {
  const posted = Date.parse(postedAt);
  if (Number.isNaN(posted)) {
    return 0;
  }
  const ageDays = Math.max(0, (referenceMs - posted) / DAY_MS);
  return 0.5 ** (ageDays / halfLifeDays);
}

/** The newest posting date in the catalog: the instant a fixed snapshot treats as today. */
export function snapshotInstant(items: readonly { readonly postedAt: string }[]): number {
  let newest = 0;
  for (const item of items) {
    const posted = Date.parse(item.postedAt);
    if (!Number.isNaN(posted) && posted > newest) {
      newest = posted;
    }
  }
  return newest;
}
