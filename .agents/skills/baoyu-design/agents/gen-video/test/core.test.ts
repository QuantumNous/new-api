import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFfmpegArgs } from "../src/orchestrator/encode.ts";
import { validate } from "../src/validate/validate.ts";
import { safeBasename } from "../src/orchestrator/filename.ts";
import { resolveOutputPath } from "../src/orchestrator/output.ts";

const common = { width: 1920, height: 1080, fps: 30, crf: 18, outPath: "/tmp/out" };

test("buildFfmpegArgs: mp4 (default)", () => {
  const args = buildFfmpegArgs({ ...common, format: "mp4", outPath: "/tmp/a.mp4" });
  assert.ok(args.includes("libx264"));
  assert.ok(args.includes("+faststart"));
  assert.ok(args.includes("yuv420p"));
  assert.ok(args.includes("scale=1920:1080:flags=lanczos"));
  assert.ok(args.includes("image2pipe"));
  assert.equal(args[args.length - 1], "/tmp/a.mp4");
});

test("buildFfmpegArgs: webm uses vp9", () => {
  const args = buildFfmpegArgs({ ...common, format: "webm", outPath: "/tmp/a.webm" });
  assert.ok(args.includes("libvpx-vp9"));
  assert.ok(!args.includes("libx264"));
});

test("buildFfmpegArgs: gif uses palette filters", () => {
  const args = buildFfmpegArgs({ ...common, format: "gif", outPath: "/tmp/a.gif" });
  const vf = args[args.indexOf("-vf") + 1];
  assert.ok(vf.includes("palettegen"));
  assert.ok(vf.includes("paletteuse"));
  assert.ok(!args.includes("libx264"));
});

test("buildFfmpegArgs: crf threads through", () => {
  const args = buildFfmpegArgs({ ...common, format: "mp4", crf: 23, outPath: "/tmp/a.mp4" });
  assert.equal(args[args.indexOf("-crf") + 1], "23");
});

const facts = {
  fontsReady: true,
  captureActive: true,
  hasFallback: false,
  duplicateFrames: 0,
  frameCount: 100,
  duration: 10,
};

test("validate: clean run → no flags", () => {
  assert.deepEqual(validate(facts), []);
});

test("validate: capture off with no fallback warns", () => {
  const flags = validate({ ...facts, captureActive: false, hasFallback: false });
  assert.ok(flags.some((f) => f.kind === "capture_mode_off"));
});

test("validate: capture off but fallback given → no capture_mode_off", () => {
  const flags = validate({ ...facts, captureActive: false, hasFallback: true });
  assert.ok(!flags.some((f) => f.kind === "capture_mode_off"));
});

test("validate: nearly-all duplicate frames warns (seeking broken)", () => {
  const flags = validate({ ...facts, duplicateFrames: 99, frameCount: 100 });
  assert.ok(flags.some((f) => f.kind === "duplicate_frames"));
});

test("validate: ~half duplicate frames is fine (paced explainer holds)", () => {
  const flags = validate({ ...facts, duplicateFrames: 52, frameCount: 100 });
  assert.ok(!flags.some((f) => f.kind === "duplicate_frames"));
});

test("validate: zero duration warns", () => {
  const flags = validate({ ...facts, duration: 0 });
  assert.ok(flags.some((f) => f.kind === "zero_duration"));
});

test("validate: fonts timeout warns", () => {
  const flags = validate({ ...facts, fontsReady: false });
  assert.ok(flags.some((f) => f.kind === "fonts_timeout"));
});

test("safeBasename: preserves Unicode, sanitizes unsafe chars", () => {
  assert.equal(safeBasename("小米SU7-外观与价格", "video"), "小米SU7-外观与价格");
  assert.equal(safeBasename("спам", "video"), "спам");
  assert.equal(safeBasename("", "video"), "video");
  assert.equal(safeBasename(undefined, "video"), "video");
  assert.equal(safeBasename("a/b\\c", "video"), "a_b_c");
  assert.equal(safeBasename("  спам  ", "video"), "спам");
  assert.equal(safeBasename(".hidden", "video"), "hidden");
  assert.equal(safeBasename("v1.2", "video"), "v1.2");
  assert.equal(safeBasename("clip.mp4", "video"), "clip.mp4");
});

test("resolveOutputPath: Unicode basename + ext de-dup", async () => {
  // own ext stripped, not doubled; Unicode preserved
  assert.equal(await resolveOutputPath("/tmp", "小米.mp4", "mp4"), "/tmp/小米.mp4");
  // path separators sanitized
  assert.equal(await resolveOutputPath("/tmp", "a/b", "webm"), "/tmp/a_b.webm");
  // non-matching ext left intact in the basename
  assert.equal(await resolveOutputPath("/tmp", "a.gif", "webm"), "/tmp/a.gif.webm");
});
