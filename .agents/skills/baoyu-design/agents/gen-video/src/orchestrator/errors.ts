// Error helpers. (Mirrors gen-pptx/orchestrator/errors.ts, phases reworded for
// the video pipeline: bridge → capture → encode.)

export function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "unknown error";
  }
}

export function timeoutHint(message: string, phase: "bridge" | "capture" | "encode"): string {
  if (!/timed?\s*out|timeout/i.test(message)) return "";
  if (phase === "bridge") {
    return ". The page never exposed the timeline bridge — confirm the URL serves the animation, that animations.jsx loaded, and that bridgeGlobal matches the page's global.";
  }
  if (phase === "encode") {
    return ". ffmpeg stalled while encoding — confirm ffmpeg is healthy and the output directory is writable.";
  }
  return ". Frame capture stalled — the animation may be too heavy per frame; try a lower fps or deviceScaleFactor.";
}
