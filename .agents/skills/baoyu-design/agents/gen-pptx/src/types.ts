// Cross-cutting data contract shared by the Node side (render/validate/orchestrator)
// and the browser side (capture). Everything here is JSON-serializable so it can
// cross the page.evaluate() boundary unchanged.

export type Mode = "editable" | "screenshots";

export interface FontSwap {
  from: string;
  to: string;
}

export interface SlideSpec {
  /** Sync JS expression run inside the page to reveal slide N (e.g. "goToSlide(0)"). */
  showJs?: string;
  /** Selector matching the slide root once shown. */
  selector: string;
  /** ms to wait after showJs for transitions (default 600). */
  delay?: number;
}

export interface GenPptxInput {
  mode?: Mode;
  width: number;
  height: number;
  slides: SlideSpec[];
  hideSelectors?: string[];
  resetTransformSelector?: string;
  googleFontImports?: string[];
  fontSwaps?: FontSwap[];
  filename?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StyleMap = Record<string, string>;

/** A captured DOM node. Mirrors the tree the in-page walk() emits. */
export interface SlideNode {
  tag: string;
  rect: Rect;
  style: StyleMap;
  children: SlideNode[];
  text?: string;
  href?: string;
  imageUrl?: string;
  svg?: string;
  /** CSS background gradient (linear/radial), rasterized to a transparent PNG. */
  gradient?: string;
  /** Uniform border-radius in px for the gradient box, when any. */
  gradientRadius?: number;
  /** Pre-transform AABB for rotated elements. */
  untransformedRect?: Rect;
  /** 1-based ordinal for <li> with a non-trivial list-style. */
  liIndex?: number;
}

export interface CapturedSlide {
  rect: Rect;
  root: SlideNode;
  notes?: string;
}

export interface SetupResult {
  notes: string[];
  fontsReady: boolean;
  resetRect: Rect | null;
  fontSwapMisses: string[];
}

export interface SlideCaptureResult {
  slide: CapturedSlide;
  hash: number;
  imagesWaited: number;
  imagesFailed: number;
}

export type WarningKind =
  | "duplicate_adjacent"
  | "duplicate_majority"
  | "slide_size_mismatch"
  | "reset_selector_miss"
  | "fonts_timeout"
  | "font_swap_failed"
  | "no_speaker_notes"
  | "notes_count_mismatch"
  | "notes_uniform_nonempty"
  | "images_failed";

export interface ValidationFlag {
  kind: WarningKind;
  message: string;
}

/** Resolved media entry — a base64 data URL plus intrinsic size when known. */
export interface MediaEntry {
  dataUrl: string;
  w?: number;
  h?: number;
}

export type MediaCache = Map<string, MediaEntry | null>;

/** A media reference collected from the captured tree, sent to the page to resolve. */
export type MediaRef =
  | { kind: "url"; key: string; url: string }
  | { kind: "svg"; key: string; svg: string; w: number; h: number }
  | { kind: "gradient"; key: string; css: string; w: number; h: number; radius: number };

/** Page's reply per ref: the resolved entry (or null) plus any warning to surface. */
export interface ResolvedMedia {
  key: string;
  value: MediaEntry | null;
  warnings: string[];
}

export interface GenPptxResult {
  bytes: number;
  slides: number;
  warnings: string[];
  validation: ValidationFlag[];
  speakerNotes: string[];
  savedPath?: string;
}
