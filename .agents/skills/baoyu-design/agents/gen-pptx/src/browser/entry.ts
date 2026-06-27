// esbuild IIFE bundle root. Attaches the capture API to window so the Node
// orchestrator can drive it via page.evaluate(). Imports only sibling browser/
// modules + type-only declarations — never render/ or core/, keeping the bundle
// sealed from the Node graph.

import { setup, type SetupInput } from "./setup.ts";
import { captureEditable, type EditableCapture } from "./capture-editable.ts";
import { captureScreenshot } from "./capture-screenshot.ts";
import { resolveMedia } from "./media-browser.ts";
import type { FontSwap, MediaRef, ResolvedMedia, SetupResult, SlideSpec } from "../types.ts";

export interface GenPptxApi {
  setup(input: SetupInput): Promise<SetupResult>;
  captureEditable(spec: SlideSpec, fontSwaps: FontSwap[]): Promise<EditableCapture>;
  captureScreenshot(spec: SlideSpec): Promise<void>;
  resolveMedia(refs: MediaRef[]): Promise<ResolvedMedia[]>;
}

declare global {
  interface Window {
    __genpptx?: GenPptxApi;
  }
}

const api: GenPptxApi = { setup, captureEditable, captureScreenshot, resolveMedia };
window.__genpptx = api;
