// Error helpers. (←ge error-stringify, ←ke timeout-hint, reworded for the
// headless-node context — there's no claude.ai preview iframe here.)

export function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "unknown error";
  }
}

export function timeoutHint(
  message: string,
  phase: "setup" | "editable" | "screenshots",
  slideNum?: number,
): string {
  if (!/timed?\s*out|timeout/i.test(message)) return "";
  if (phase === "setup") {
    return ". The page didn't finish loading the deck in time — confirm the URL serves the deck, then retry.";
  }
  const where = `slide ${slideNum}`;
  return phase === "editable"
    ? `. Capture stalled on ${where} (slide too heavy for editable capture). Retrying identically will stall again — tell the user, then retry with mode:'screenshots' for a pixel-perfect non-editable fallback.`
    : `. Capture stalled on ${where}. Retrying identically may stall again — tell the user and consider a longer delay.`;
}
