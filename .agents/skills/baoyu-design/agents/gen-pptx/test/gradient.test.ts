import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCssGradient, resolveStops } from "../src/browser/gradient.ts";

test("parseCssGradient: angled alpha-fading scrim keeps every stop", () => {
  const g = parseCssGradient(
    "linear-gradient(105deg, rgba(8, 10, 13, 0.92) 0%, rgba(8, 10, 13, 0.62) 38%, rgba(8, 10, 13, 0.05) 72%)",
    1920,
    1080,
  );
  assert.ok(g && g.type === "linear");
  assert.equal((g as { angle: number }).angle, 105);
  assert.equal(g.stops.length, 3);
  const resolved = resolveStops(g.stops, 1000);
  assert.deepEqual(
    resolved.map((s) => s.offset),
    [0, 0.38, 0.72],
  );
  assert.equal(resolved[2].color, "rgba(8, 10, 13, 0.05)");
});

test("parseCssGradient: 'to <side>' directions map to CSS angles", () => {
  assert.equal((parseCssGradient("linear-gradient(to right, red, blue)", 100, 100) as any).angle, 90);
  assert.equal((parseCssGradient("linear-gradient(to top, red, blue)", 100, 100) as any).angle, 0);
  assert.equal((parseCssGradient("linear-gradient(to bottom, red, blue)", 100, 100) as any).angle, 180);
  assert.equal((parseCssGradient("linear-gradient(to left, red, blue)", 100, 100) as any).angle, 270);
  // no direction → CSS default "to bottom" (180deg)
  assert.equal((parseCssGradient("linear-gradient(red, blue)", 100, 100) as any).angle, 180);
});

test("parseCssGradient: angle units + corner directions", () => {
  assert.equal((parseCssGradient("linear-gradient(0.5turn, red, blue)", 100, 100) as any).angle, 180);
  // square box → top-right corner is 45deg
  assert.equal((parseCssGradient("linear-gradient(to top right, red, blue)", 100, 100) as any).angle, 45);
});

test("parseCssGradient: radial + unsupported gradients", () => {
  const r = parseCssGradient("radial-gradient(circle at center, #fff 0%, #000 100%)", 100, 100);
  assert.ok(r && r.type === "radial");
  assert.equal(r.stops.length, 2);
  assert.equal(parseCssGradient("conic-gradient(red, blue)", 100, 100), null);
  assert.equal(parseCssGradient("repeating-linear-gradient(red, blue)", 100, 100), null);
  assert.equal(parseCssGradient("none", 100, 100), null);
  assert.equal(parseCssGradient("url(x.png)", 100, 100), null);
});

test("resolveStops: evenly spaces unspecified positions", () => {
  const g = parseCssGradient("linear-gradient(90deg, red, lime, blue, black)", 100, 100)!;
  const offs = resolveStops(g.stops, 100).map((s) => s.offset);
  assert.deepEqual(offs, [0, 1 / 3, 2 / 3, 1]);
});

test("resolveStops: clamps decreasing positions monotonic and px→fraction", () => {
  const g = parseCssGradient("linear-gradient(90deg, red 50%, blue 20%)", 100, 100)!;
  const offs = resolveStops(g.stops, 100).map((s) => s.offset);
  assert.deepEqual(offs, [0.5, 0.5]); // 20% clamped up to 50%
  const px = parseCssGradient("linear-gradient(90deg, red 0px, blue 50px)", 100, 100)!;
  assert.deepEqual(
    resolveStops(px.stops, 100).map((s) => s.offset),
    [0, 0.5],
  );
});
