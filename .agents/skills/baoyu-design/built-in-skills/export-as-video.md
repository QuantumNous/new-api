---
name: "export-as-video"
description: "Export as video\nRender a timeline animation to a real .mp4"
---
# Export to Video

Render a finished timeline animation to a real video file (`.mp4`, `.webm`, or `.gif`). One `gen_video` call drives a headless Chromium, seeks the animation frame-by-frame through its timeline bridge, and pipes the frames to **ffmpeg**.

> **Precondition — timeline animations only, not any HTML.** This records a *Stage / timeline animation* — the [animated-video](animated-video.md) format this skill produces (the `animations.jsx` starter), or any page that exposes a timeline bridge (a `window` global with `setTime(seconds)`, `setPlaying(false)`, and a `duration`). It is **not** a general HTML→video screen recorder: pointed at a static page or a prototype with no seekable timeline, every frame is identical. If the target isn't a seekable animation, tell the user it isn't supported.

## What you do

1. **Know the animation.** You probably wrote it. If not, read the HTML to find: the Stage size (`width`/`height`), the total `duration`, and the timeline bridge global. A Stage from the current `animations.jsx` starter registers `window.__animStage` and supports `?capture` — so it needs **zero config beyond `width`/`height`**. A hand-rolled or older animation may expose a different global (e.g. `__ahe`) — set `bridgeGlobal` and provide the CSS fallback (see below).
2. **Serve the animation over HTTP** per your harness reference so it loads at an `http(s)` URL (multi-file `<script src>` pages won't run from `file://`).
3. **Write the config JSON** (below) and **call `gen_video`**.
4. **Read the validation flags** in the result and decide if you need to retry.

> **Claude Code:** there is no `gen_video` tool — run it as a local CLI. Serve the animation over HTTP, write the inputs below to a JSON file, then `node <skill>/agents/gen-video/dist/cli.mjs --url <servedUrl> --config <jsonPath> --out designs/<project>`, and read `flags` from the printed JSON. Full invocation + one-time setup (incl. ffmpeg): [`../references/claude.md`](../references/claude.md) → "Exporting to video".

## gen_video inputs

```jsonc
{
  "width": 1920, "height": 1080,   // required — CSS px, the Stage size
  "duration": 95,                  // sec; optional, else read from the bridge's duration
  "fps": 30,                       // default 30
  "deviceScaleFactor": 2,          // default 2 — supersample, then lanczos-downscale for crispness
  "startMs": 0, "endMs": 95000,    // optional sub-range to export
  "format": "mp4",                 // "mp4" | "webm" | "gif" (default mp4)
  "crf": 18,                       // x264/vp9 quality, lower = better (default 18)
  "captureParam": "capture",       // URL param appended to force capture mode (default "capture")
  "bridgeGlobal": "__animStage",   // default; set "__ahe" (or another global) for older/hand-rolled timelines
  // CSS fallback — ONLY needed when capture mode can't engage (an older Stage
  // copy or a hand-rolled animation). A current animations.jsx in capture mode
  // strips its own chrome, so leave these out.
  "hideSelectors": ["[data-stage-chrome]"],
  "resetTransformSelector": "[data-stage-canvas]",
  "filename": "my-animation"
}
```

For a Stage built from the current `animations.jsx` starter, the minimal config is just `{ "width": 1920, "height": 1080, "filename": "…" }` — capture mode engages from the appended `?capture`, the bridge supplies the duration, and the component strips its own scrubber and letterboxing. Add `duration`/`startMs`/`endMs` only to override or trim.

## Validation flags

The result lists flags. **These are warnings, not errors** — read each message and decide if it's expected for THIS animation:

- `capture_mode_off` — capture mode didn't engage and no CSS fallback was given, so frames may include the scrubber or letterboxing. Re-copy `animations.jsx`, confirm `?capture` is honored, or pass `hideSelectors` + `resetTransformSelector`.
- `duplicate_frames` — most frames were identical to their predecessor. The timeline isn't seeking: wrong `bridgeGlobal`, `setTime` not wired, or the animation is genuinely static. Check the bridge global first.
- `fonts_timeout` — `document.fonts.ready` took >8s. Font URLs may be unreachable; text may render with a fallback face.
- `zero_duration` — the resolved duration was 0. Pass an explicit `duration`, or expose `bridge.duration`. Only a single frame was rendered.

A failure (no bridge found, or ffmpeg errored) returns `{ ok: false, error }` instead of flags — fix the cause (`bridge_missing`: wrong/missing `bridgeGlobal`; `ffmpeg_failed`: ffmpeg not healthy) and retry.

**Talking to the user about flags:** these names and messages are internal diagnostics — do NOT relay them verbatim. If everything is expected, don't mention validation at all; just confirm the file was written. If something looks genuinely wrong, describe it in plain language without the flag identifier — e.g. "Heads up: the animation may not have been seeking, so the video looks frozen — let me check the timeline hook and retry." rather than quoting `duplicate_frames`.

## Quality & format

| Lever | Effect |
|---|---|
| `fps` | 30 is smooth for most explainers; 60 doubles frames + render time for fast motion; 24 for a filmic feel. |
| `crf` | Lower = higher quality + bigger file. 18 ≈ visually lossless; 23 is a smaller, still-clean default; >28 starts to show artifacts. |
| `deviceScaleFactor` | 2 supersamples then downscales (crisp text/edges). 1 is faster but softer; >2 rarely pays off and is much slower. |
| `format` | `mp4` (H.264) for sharing/embedding; `webm` (VP9) for the web with smaller files; `gif` for short loops (large, 256 colors — keep it brief). |

Frame count is `fps × (endMs − startMs)`, and every frame is a real headless screenshot, so long high-fps exports take minutes — pick `startMs`/`endMs` to iterate on a section, then run the full range. Then surface the file (e.g. `SendUserFile`).
