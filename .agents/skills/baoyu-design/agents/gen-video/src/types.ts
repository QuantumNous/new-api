// Data contract for gen-video. Mirrors gen-pptx/types.ts in spirit: a single
// JSON-serializable input object and a structured result. The browser side only
// needs a tiny timeline bridge (setTime / setPlaying / duration), so there is no
// captured-DOM tree here.

export type VideoFormat = "mp4" | "webm" | "gif";

export interface GenVideoInput {
  /** CSS px — the Stage size. Required. */
  width: number;
  height: number;
  /** Seconds. Optional; falls back to bridge.duration. */
  duration?: number;
  /** Frames per second. Default 30. */
  fps?: number;
  /** Supersample factor for crisp downscaled output. Default 2. */
  deviceScaleFactor?: number;
  /** Optional sub-range to export (ms). Default 0 → duration. */
  startMs?: number;
  endMs?: number;
  /** Output container/codec. Default "mp4". */
  format?: VideoFormat;
  /** x264 / vp9 quality (lower = better). Default 18. */
  crf?: number;
  /** URL query param appended to force capture mode in the page. Default "capture". */
  captureParam?: string;
  /** Window global holding the timeline bridge. Default "__animStage". */
  bridgeGlobal?: string;
  /** CSS fallback (used only when capture mode didn't engage): hide chrome. */
  hideSelectors?: string[];
  /** CSS fallback: element whose transform/size is reset to the Stage size. */
  resetTransformSelector?: string | null;
  /** Output basename (no extension). */
  filename?: string;
}

export type WarningKind =
  | "bridge_missing"
  | "capture_mode_off"
  | "fonts_timeout"
  | "duplicate_frames"
  | "zero_duration"
  | "ffmpeg_failed";

export interface ValidationFlag {
  kind: WarningKind;
  message: string;
}

export interface GenVideoResult {
  bytes: number;
  frames: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  validation: ValidationFlag[];
  warnings: string[];
}
