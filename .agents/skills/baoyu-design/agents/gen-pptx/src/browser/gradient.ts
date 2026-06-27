// Parse a CSS linear/radial gradient and paint it onto a canvas → transparent
// PNG. pptxgenjs has no gradient fill, so the renderer's only other option is a
// flat fill from the first color stop — which turns an alpha-fading scrim into a
// uniform near-opaque rectangle that darkens the whole image. Rasterizing the
// gradient (canvas honors per-stop rgba alpha) preserves the fade exactly.
//
// parseCssGradient / resolveStops are pure (Node-testable); rasterizeGradient
// uses the DOM and only runs in the page. (←gradient overlay fidelity)

export type StopPos = { unit: "%" | "px"; v: number } | null;
export interface GradientStop {
  color: string;
  pos: StopPos;
}
export interface LinearGradient {
  type: "linear";
  /** CSS angle in degrees (0 = to top, clockwise). */
  angle: number;
  stops: GradientStop[];
}
export interface RadialGradient {
  type: "radial";
  shape: "circle" | "ellipse";
  stops: GradientStop[];
}
export type ParsedGradient = LinearGradient | RadialGradient;

const clamp = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : n);

const ANGLE_RE = /^(-?[\d.]+)(deg|grad|rad|turn)$/;
// Leading color token: hex, rgb()/rgba(), hsl()/hsla(), or a bare keyword.
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)/;

function angleUnitToDeg(v: number, unit: string): number {
  switch (unit) {
    case "rad":
      return (v * 180) / Math.PI;
    case "grad":
      return v * 0.9;
    case "turn":
      return v * 360;
    default:
      return v;
  }
}

// "to <side|corner>" → CSS angle in degrees. Corners use the box aspect. (←dir)
function directionToDeg(token: string, w: number, h: number): number | null {
  const t = token.trim();
  if (!t.startsWith("to ")) return null;
  const sides = t
    .slice(3)
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
  const corner = (Math.atan2(w, h) * 180) / Math.PI;
  switch (sides) {
    case "top":
      return 0;
    case "right":
      return 90;
    case "bottom":
      return 180;
    case "left":
      return 270;
    case "right top":
      return corner; // to top right
    case "bottom right":
      return 180 - corner;
    case "bottom left":
      return 180 + corner;
    case "left top":
      return 360 - corner; // to top left
    default:
      return 180;
  }
}

// Split on top-level commas (ignoring those inside rgb()/hsl() parens). (←split)
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// One arg → its color stop(s). "color", "color 30%", or the double-position
// "color 10% 20%" form (which expands to two stops). (←stop)
function parseStops(arg: string): GradientStop[] {
  const m = arg.match(COLOR_RE);
  if (!m) return [];
  const color = m[0];
  const rest = arg.slice(color.length);
  const positions = [...rest.matchAll(/(-?[\d.]+)(%|px)/g)];
  if (positions.length === 0) return [{ color, pos: null }];
  return positions.map((p) => ({
    color,
    pos: { unit: p[2] as "%" | "px", v: parseFloat(p[1]) },
  }));
}

// Extract the first linear/radial gradient function's body (balanced parens).
// repeating-* and conic-gradient return null → caller falls back to flat fill.
function extractGradient(css: string): { kind: "linear" | "radial"; body: string } | null {
  const m = css.match(/(repeating-)?(linear|radial|conic)-gradient\(/);
  if (!m || m.index === undefined) return null;
  if (m[1] || m[2] === "conic") return null;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  let i = open;
  for (; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")" && --depth === 0) break;
  }
  if (depth !== 0) return null;
  return { kind: m[2] as "linear" | "radial", body: css.slice(open + 1, i) };
}

const RADIAL_CONFIG_RE =
  /\b(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at)\b/;
const RADIAL_SIZE_RE = /^\s*[\d.]+(px|%|em|rem|vw|vh)(\s+[\d.]+(px|%|em|rem|vw|vh))?\s*$/;

export function parseCssGradient(css: string, w: number, h: number): ParsedGradient | null {
  const g = extractGradient(css);
  if (!g) return null;
  const args = splitTopLevel(g.body);
  if (args.length < 2) return null;

  if (g.kind === "linear") {
    let angle = 180; // CSS default direction is "to bottom"
    let start = 0;
    const first = args[0];
    const am = first.match(ANGLE_RE);
    if (am) {
      angle = ((angleUnitToDeg(parseFloat(am[1]), am[2]) % 360) + 360) % 360;
      start = 1;
    } else {
      const d = directionToDeg(first, w, h);
      if (d !== null) {
        angle = d;
        start = 1;
      }
    }
    const stops: GradientStop[] = [];
    for (let i = start; i < args.length; i++) stops.push(...parseStops(args[i]));
    return stops.length >= 2 ? { type: "linear", angle, stops } : null;
  }

  // radial
  let start = 0;
  const first = args[0];
  if (RADIAL_CONFIG_RE.test(first) || RADIAL_SIZE_RE.test(first)) start = 1;
  const stops: GradientStop[] = [];
  for (let i = start; i < args.length; i++) stops.push(...parseStops(args[i]));
  return stops.length >= 2
    ? { type: "radial", shape: /circle/.test(first) ? "circle" : "ellipse", stops }
    : null;
}

// Resolve stop positions to monotonic offsets in [0,1]. px positions divide by
// the gradient line length; bare stops are spaced evenly (CSS rule). (←norm)
export function resolveStops(
  stops: GradientStop[],
  lengthPx: number,
): { color: string; offset: number }[] {
  const n = stops.length;
  const off: (number | null)[] = stops.map((s) => {
    if (!s.pos) return null;
    if (s.pos.unit === "%") return s.pos.v / 100;
    return lengthPx > 0 ? s.pos.v / lengthPx : null;
  });
  if (off[0] === null) off[0] = 0;
  if (off[n - 1] === null) off[n - 1] = 1;
  // clamp defined positions to be non-decreasing
  let prev = off[0] as number;
  for (let i = 1; i < n; i++) {
    if (off[i] !== null) {
      if ((off[i] as number) < prev) off[i] = prev;
      prev = off[i] as number;
    }
  }
  // linearly interpolate runs of unspecified positions
  let i = 0;
  while (i < n) {
    if (off[i] === null) {
      let j = i;
      while (j < n && off[j] === null) j++;
      const lo = off[i - 1] as number;
      const hi = off[j] as number;
      const span = j - (i - 1);
      for (let k = i; k < j; k++) off[k] = lo + ((hi - lo) * (k - (i - 1))) / span;
      i = j;
    } else i++;
  }
  return stops.map((s, idx) => ({ color: s.color, offset: clamp(off[idx] as number, 0, 1) }));
}

// Gradients are smooth, so a sub-slide raster downscales/upscales invisibly
// while keeping the embedded PNG small.
const MAX_RASTER_DIM = 1280;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Paint a CSS gradient onto a transparent canvas at (capped) box size → PNG data
// URL. radiusPx clips to a rounded rect so gradient cards keep their corners.
// Returns null on any failure → renderer falls back to the flat first-stop fill.
export function rasterizeGradient(
  css: string,
  w: number,
  h: number,
  radiusPx: number,
): string | null {
  try {
    const g = parseCssGradient(css, w, h);
    if (!g) return null;
    const scale = Math.min(1, MAX_RASTER_DIM / Math.max(w, h, 1));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const rpx = radiusPx > 0 ? Math.min(radiusPx * scale, cw / 2, ch / 2) : 0;
    if (rpx > 0) {
      roundRectPath(ctx, 0, 0, cw, ch, rpx);
      ctx.clip();
    }

    let grad: CanvasGradient;
    if (g.type === "linear") {
      const a = (g.angle * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const len = Math.abs(cw * Math.sin(a)) + Math.abs(ch * Math.cos(a));
      const cx = cw / 2;
      const cy = ch / 2;
      grad = ctx.createLinearGradient(
        cx - (dx * len) / 2,
        cy - (dy * len) / 2,
        cx + (dx * len) / 2,
        cy + (dy * len) / 2,
      );
      for (const s of resolveStops(g.stops, len)) grad.addColorStop(s.offset, s.color);
    } else {
      const cx = cw / 2;
      const cy = ch / 2;
      const r = Math.hypot(cw, ch) / 2;
      grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      for (const s of resolveStops(g.stops, r)) grad.addColorStop(s.offset, s.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
