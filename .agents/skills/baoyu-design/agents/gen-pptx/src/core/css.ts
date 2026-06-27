import { clamp, pxToPoints } from "./units.ts";
import { parseColor } from "./color.ts";
import type { StyleMap } from "../types.ts";

// First px length in a value, else 0. (←T)
export function extractPx(value: string | null | undefined): number {
  if (!value) return 0;
  const m = value.match(/(-?[\d.]+)px/);
  return m ? parseFloat(m[1]) : 0;
}

// font-weight → bold? "bold"/"bolder" or numeric >= 600. (←nt)
export function isBold(weight: string | null | undefined): boolean {
  if (!weight) return false;
  if (weight === "bold" || weight === "bolder") return true;
  const n = parseInt(weight, 10);
  return !isNaN(n) && n >= 600;
}

export type Align = "left" | "center" | "right" | "justify";

// text-align → PptxGenJS align. (←we)
export function textAlign(value: string | null | undefined): Align {
  switch (value) {
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    case "justify":
      return "justify";
    default:
      return "left";
  }
}

export type DashType = "dash" | "dot" | "solid" | undefined;

// CSS border-style → PptxGenJS line dashType. double collapses to solid. (←st)
export function borderStyleToDashType(value: string | null | undefined): DashType {
  switch (value) {
    case "dashed":
      return "dash";
    case "dotted":
      return "dot";
    case "double":
      return "solid";
    default:
      return undefined;
  }
}

// border-radius → px, clamped to half the shorter side. (←at)
export function parseBorderRadius(value: string | null | undefined, minSide: number): number {
  if (!value || minSide <= 0) return 0;
  const pct = value.match(/^([\d.]+)%/);
  const px = pct ? (parseFloat(pct[1]) / 100) * minSide : extractPx(value);
  return px <= 0 ? 0 : clamp(px, 0, minSide / 2);
}

// transform → rotation degrees (rotate() or matrix()), undefined when ~0. (←it)
export function extractRotation(transform: string | null | undefined): number | undefined {
  if (!transform || transform === "none") return undefined;
  const rot = transform.match(/rotate\((-?[\d.]+)deg\)/);
  if (rot) {
    const deg = parseFloat(rot[1]);
    return deg === 0 ? undefined : deg;
  }
  const mat = transform.match(/matrix\(\s*([^,\s]+),\s*([^,\s]+),/);
  if (mat) {
    const a = parseFloat(mat[1]);
    const b = parseFloat(mat[2]);
    const deg = Math.atan2(b, a) * (180 / Math.PI);
    return Math.abs(deg) < 0.01 ? undefined : deg;
  }
  return undefined;
}

export interface ShadowSpec {
  type: "outer";
  color: string;
  opacity: number;
  blur: number;
  offset: number;
  angle: number;
}

// First non-inset box/text shadow → PptxGenJS shadow spec. (←se)
export function parseShadow(value: string | null | undefined): ShadowSpec | null {
  if (!value || value === "none") return null;
  // Split on top-level commas (color funcs contain their own commas).
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);

  for (const part of parts) {
    const s = part.trim();
    if (/\binset\b/.test(s)) continue;
    const colorMatch = s.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
    const color = colorMatch ? parseColor(colorMatch[0]) : { hex: "000000", alpha: 0.3 };
    if (!color) continue;
    const lengths = s.replace(colorMatch?.[0] ?? "", "").match(/-?[\d.]+px/g);
    if (!lengths || lengths.length < 2) continue;
    const offsetX = parseFloat(lengths[0]);
    const offsetY = parseFloat(lengths[1]);
    const blur = lengths[2] ? parseFloat(lengths[2]) : 0;
    const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    let angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return {
      type: "outer",
      color: color.hex,
      opacity: clamp(color.alpha, 0, 1),
      blur: clamp(pxToPoints(blur), 0, 100),
      offset: clamp(pxToPoints(dist), 0, 200),
      angle: Math.round(angle),
    };
  }
  return null;
}

// line-height → PptxGenJS lineSpacingMultiple. px values normalize against the
// 1.3333 default leading; unitless multipliers pass through. (←be)
export function lineSpacingMultiple(
  lineHeight: string | null | undefined,
  fontSizePx: number,
): number | undefined {
  if (!lineHeight || lineHeight === "normal") return undefined;
  const px = extractPx(lineHeight);
  if (px > 0) {
    const baseline = fontSizePx * 1.3333333333333333;
    return baseline <= 0 ? undefined : clamp(px / baseline, 0.5, 5);
  }
  const mult = parseFloat(lineHeight);
  if (!isNaN(mult) && mult > 0 && mult < 10) return clamp(mult, 0.5, 5);
  return undefined;
}

// letter-spacing px → points. (←ye)
export function letterSpacingPoints(value: string | null | undefined): number | undefined {
  if (!value || value === "normal") return undefined;
  const px = extractPx(value);
  if (px !== 0) return clamp(pxToPoints(px), -20, 100);
  return undefined;
}

// text-decoration-style → PptxGenJS underline style. (←gt)
export function underlineStyle(value: string | null | undefined): string {
  switch (value) {
    case "double":
      return "dbl";
    case "dotted":
      return "dotted";
    case "dashed":
      return "dash";
    case "wavy":
      return "wavy";
    default:
      return "sng";
  }
}

// White-space modes that preserve both spaces and newlines verbatim. (←keepWs)
export function isPreserveWhitespace(whiteSpace: string | null | undefined): boolean {
  return whiteSpace === "pre" || whiteSpace === "pre-wrap" || whiteSpace === "break-spaces";
}

// Drop newlines that only lead/trail a whole assembled block — the
// `<pre>\n …\n</pre>` idiom — without touching interior line breaks.
export function trimBlockNewlines(text: string): string {
  return text.replace(/^\n+|\n+$/g, "");
}

// Normalize text per white-space. Newlines (and, for pre/pre-wrap, spaces) are
// preserved verbatim; trimming of block-leading/trailing newlines is left to the
// caller so interior line breaks between sibling runs survive. (←he)
export function normalizeText(text: string, whiteSpace: string | null | undefined): string {
  if (isPreserveWhitespace(whiteSpace)) {
    return text;
  }
  if (whiteSpace === "pre-line") {
    return text
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n");
  }
  return text.replace(/\s+/g, " ").trim();
}

// Should this box suppress wrapping? (←ve — render uses `wrap: !noWrap(style)`)
export function noWrap(style: StyleMap): boolean {
  if (style.whiteSpace === "pre") return true;
  if (style.whiteSpace !== "nowrap") return false;
  const overflow = (style.overflow ?? "").trim().split(/\s+/)[0] ?? "";
  const scrollable = overflow === "auto" || overflow === "scroll" || overflow === "overlay";
  const ellipsis =
    (overflow === "hidden" || overflow === "clip") &&
    (style.textOverflow ?? "").includes("ellipsis");
  return !scrollable && !ellipsis;
}
