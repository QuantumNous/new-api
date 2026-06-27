// Orchestrates a full export: wait for the timeline bridge + fonts → pause
// playback → resolve duration/frame count → (CSS chrome fallback if capture mode
// is off) → seek + screenshot each frame into ffmpeg → validate. Returns the
// saved path + a structured result; the caller writes the JSON line.

import { stat } from "node:fs/promises";
import { FfmpegEncoder } from "./encode.ts";
import { resolveOutputPath } from "./output.ts";
import { stringifyError, timeoutHint } from "./errors.ts";
import { validate } from "../validate/validate.ts";
import type { PlaywrightDriver } from "./driver.ts";
import type { GenVideoInput, GenVideoResult, VideoFormat } from "../types.ts";

export interface RunOutput {
  result: GenVideoResult;
  file: string;
}

const SETUP_RACE_MS = 8000;

interface Setup {
  hasBridge: boolean;
  fontsReady: boolean;
  bridgeDuration: number | null;
  captureActive: boolean;
}

/** Wait (≤8s) for the bridge global to appear and document.fonts to settle. */
async function waitForSetup(
  driver: PlaywrightDriver,
  bridgeGlobal: string,
): Promise<Setup> {
  return await driver.page.evaluate(
    async ({ g, timeout }) => {
      const deadline = Date.now() + timeout;
      const get = () =>
        (window as unknown as Record<string, { setTime?: unknown; duration?: unknown; captureActive?: unknown }>)[g];
      while (Date.now() < deadline) {
        const b = get();
        if (b && typeof b.setTime === "function") break;
        await new Promise((r) => setTimeout(r, 50));
      }
      const b = get();
      const hasBridge = !!(b && typeof b.setTime === "function");
      let fontsReady = false;
      try {
        const remaining = Math.max(0, deadline - Date.now());
        await Promise.race([
          document.fonts.ready.then(() => {
            fontsReady = true;
          }),
          new Promise((r) => setTimeout(r, remaining)),
        ]);
      } catch {
        fontsReady = true;
      }
      let bridgeDuration: number | null = null;
      let captureActive = false;
      if (hasBridge && b) {
        try {
          const d = b.duration;
          if (typeof d === "number" && isFinite(d)) bridgeDuration = d;
        } catch {
          /* getter threw */
        }
        try {
          captureActive = !!b.captureActive;
        } catch {
          /* getter threw */
        }
      }
      return { hasBridge, fontsReady, bridgeDuration, captureActive };
    },
    { g: bridgeGlobal, timeout: SETUP_RACE_MS },
  );
}

/** CSS fallback for pages where capture mode didn't engage (old copies / __ahe). */
async function applyChromeFallback(
  driver: PlaywrightDriver,
  hide: string[],
  reset: string | null,
  width: number,
  height: number,
): Promise<void> {
  await driver.page.evaluate(
    ({ hide, reset, w, h }) => {
      const style = document.createElement("style");
      let css = "*{transition:none !important;}";
      for (const sel of hide) css += `${sel}{display:none !important;}`;
      if (reset) {
        css += `${reset}{transform:none !important;box-shadow:none !important;width:${w}px !important;height:${h}px !important;}`;
      }
      style.setAttribute("data-genvideo", "1");
      style.textContent = css;
      document.head.appendChild(style);
      // Pin the reset element to the top-left of its parent so the screenshot
      // viewport frames it exactly (the Stage normally centers the canvas).
      if (reset) {
        const el = document.querySelector(reset);
        const parent = el && el.parentElement;
        if (parent) {
          parent.style.setProperty("align-items", "flex-start", "important");
          parent.style.setProperty("justify-content", "flex-start", "important");
          parent.style.setProperty("overflow", "visible", "important");
        }
      }
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    },
    { hide, reset, w: width, h: height },
  );
  await driver.page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

/** djb2 over the middle 4096 bytes — cheap adjacent-frame duplicate detector. */
function quickHash(buf: Buffer): number {
  let v = 5381;
  const mid = buf.length >> 1;
  const end = Math.min(buf.length, mid + 4096);
  for (let i = mid; i < end; i++) v = ((v << 5) + v + buf[i]) | 0;
  return v >>> 0;
}

export async function runGenVideo(
  input: GenVideoInput,
  driver: PlaywrightDriver,
  outDir: string,
): Promise<RunOutput> {
  const fps = Math.max(1, Math.round(input.fps ?? 30));
  const format: VideoFormat = input.format ?? "mp4";
  const crf = input.crf ?? 18;
  const bridgeGlobal = input.bridgeGlobal ?? "__animStage";

  const setup = await waitForSetup(driver, bridgeGlobal);
  if (!setup.hasBridge) {
    throw new Error(
      `genVideo: no timeline bridge at window.${bridgeGlobal}. The page must expose a bridge with setTime()/duration — re-copy starter-components/animations.jsx (it registers window.__animStage), or set bridgeGlobal to the page's global (e.g. "__ahe").${timeoutHint("timed out", "bridge")}`,
    );
  }

  // Pause playback so seeking is deterministic.
  await driver.page.evaluate((g) => {
    const b = (window as unknown as Record<string, { setPlaying?: (p: boolean) => void }>)[g];
    try {
      b?.setPlaying?.(false);
    } catch {
      /* best-effort */
    }
  }, bridgeGlobal);

  const duration = input.duration ?? setup.bridgeDuration ?? 0;
  const startMs = Math.max(0, input.startMs ?? 0);
  const endMs = input.endMs ?? duration * 1000;
  const totalMs = Math.max(0, endMs - startMs);
  const frameCount = Math.max(1, Math.round((totalMs / 1000) * fps));

  const hasFallback = (input.hideSelectors?.length ?? 0) > 0 || !!input.resetTransformSelector;
  if (!setup.captureActive && hasFallback) {
    await applyChromeFallback(
      driver,
      input.hideSelectors ?? [],
      input.resetTransformSelector ?? null,
      input.width,
      input.height,
    );
  }

  const outPath = await resolveOutputPath(outDir, input.filename, format);
  const encoder = new FfmpegEncoder({
    format,
    width: input.width,
    height: input.height,
    fps,
    crf,
    outPath,
  });

  let prevHash = -1;
  let dupCount = 0;
  try {
    for (let i = 0; i < frameCount; i++) {
      const tSec = (startMs + (i * 1000) / fps) / 1000;
      await driver.seek(bridgeGlobal, tSec);
      const buf = await driver.screenshotBuffer();
      const h = quickHash(buf);
      if (i > 0 && h === prevHash) dupCount++;
      prevHash = h;
      await encoder.writeFrame(buf);
    }
  } catch (err) {
    encoder.destroy();
    const msg = stringifyError(err);
    throw new Error(`genVideo: frame capture failed: ${msg}${timeoutHint(msg, "capture")}`);
  }

  try {
    await encoder.finish();
  } catch (err) {
    const msg = stringifyError(err);
    throw new Error(`genVideo: ffmpeg failed: ${msg}${timeoutHint(msg, "encode")}`);
  }

  const { size } = await stat(outPath);
  const validation = validate({
    fontsReady: setup.fontsReady,
    captureActive: setup.captureActive,
    hasFallback,
    duplicateFrames: dupCount,
    frameCount,
    duration,
  });

  return {
    file: outPath,
    result: {
      bytes: size,
      frames: frameCount,
      fps,
      duration,
      width: input.width,
      height: input.height,
      validation,
      warnings: [],
    },
  };
}
