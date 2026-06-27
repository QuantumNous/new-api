// Cross-check the capture against the request and emit advisory flags. Fatal
// conditions (no bridge, ffmpeg failure) throw upstream and are not represented
// here — these are the non-fatal warnings worth surfacing in plain language.

import type { ValidationFlag } from "../types.ts";

export interface VideoFacts {
  fontsReady: boolean;
  captureActive: boolean;
  hasFallback: boolean;
  duplicateFrames: number;
  frameCount: number;
  duration: number;
}

export function validate(f: VideoFacts): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (f.duration <= 0) {
    flags.push({
      kind: "zero_duration",
      message:
        "Resolved animation duration was 0 — pass an explicit duration (seconds) in the config, or expose bridge.duration. Only a single frame was rendered.",
    });
  }

  if (!f.fontsReady) {
    flags.push({
      kind: "fonts_timeout",
      message:
        "document.fonts.ready did not resolve within 8s — frames may use fallback fonts. Check that font URLs are reachable.",
    });
  }

  if (!f.captureActive && !f.hasFallback) {
    flags.push({
      kind: "capture_mode_off",
      message:
        "Capture mode did not engage and no hideSelectors/resetTransformSelector fallback was given — frames may include the scrubber and letterboxing. Load the page with ?capture, re-copy starter-components/animations.jsx, or pass hideSelectors + resetTransformSelector.",
    });
  }

  // A well-paced explainer holds each beat for seconds, so ~half its adjacent
  // frames are legitimately identical — that is not a defect. Only flag when
  // nearly every frame repeats, the signature of seeking that never advances
  // (setTime unwired / wrong bridgeGlobal) or a truly static page.
  if (f.frameCount >= 8 && f.duplicateFrames > f.frameCount * 0.85) {
    flags.push({
      kind: "duplicate_frames",
      message: `${f.duplicateFrames}/${f.frameCount} frames were identical to their predecessor — almost nothing changed across the timeline, so seeking likely isn't advancing (wrong bridgeGlobal, or setTime isn't wired) or the page is static. (Some duplicate frames are normal during deliberate held beats.)`,
    });
  }

  return flags;
}
