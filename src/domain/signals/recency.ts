const DAY_MS = 24 * 60 * 60 * 1000;

export function recencyScore(postedAt: string, now: number): number {
  const posted = Date.parse(postedAt);
  if (Number.isNaN(posted)) {
    return 0;
  }
  const ageDays = Math.max(0, (now - posted) / DAY_MS);
  return 1 / (1 + ageDays);
}
