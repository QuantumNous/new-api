/**
 * Calculates a token rate in tokens per second.
 *
 * Returns 0 when the token count is unknown, the duration is unknown or 0, or
 * the computed rate cannot be represented as a finite JSON-safe number.
 */
export function calculateTokensPerSecond({
  tokens,
  durationMs,
}: {
  tokens: number | undefined;
  durationMs: number | undefined;
}): number {
  const tokenRate = (1000 * (tokens ?? 0)) / (durationMs ?? 0);

  return Number.isFinite(tokenRate) ? tokenRate : 0;
}
