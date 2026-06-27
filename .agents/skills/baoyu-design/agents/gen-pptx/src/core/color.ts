import { clamp } from "./units.ts";

export interface ParsedColor {
  /** 6-digit uppercase hex, no leading #. */
  hex: string;
  /** 0..1 */
  alpha: number;
}

// Parse a CSS color to {hex, alpha}. Handles transparent/none, #hex (3/4/6/8
// digit, 8th pair = alpha/255), and rgb()/rgba(). Returns null for transparent,
// fully-transparent (alpha 0), or unparseable input. (←U)
export function parseColor(input: string | null | undefined): ParsedColor | null {
  if (!input) return null;
  const r = input.trim().toLowerCase();
  if (r === "transparent" || r === "none") return null;

  if (r[0] === "#") {
    let body = r.slice(1);
    if (body.length === 3 || body.length === 4) {
      body = body
        .split("")
        .map((c) => c + c)
        .join("");
    }
    let alpha = 1;
    if (body.length === 8) {
      alpha = parseInt(body.slice(6, 8), 16) / 255;
      body = body.slice(0, 6);
    }
    if (alpha === 0 || body.length !== 6 || /[^0-9a-f]/.test(body)) return null;
    return { hex: body.toUpperCase(), alpha };
  }

  const m = r.match(
    /rgba?\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/,
  );
  if (m) {
    const red = clamp(Math.round(parseFloat(m[1])), 0, 255);
    const green = clamp(Math.round(parseFloat(m[2])), 0, 255);
    const blue = clamp(Math.round(parseFloat(m[3])), 0, 255);
    let alpha = 1;
    if (m[4] !== undefined) {
      alpha = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      alpha = clamp(alpha, 0, 1);
    }
    if (alpha === 0) return null;
    return {
      hex: ((red << 16) | (green << 8) | blue)
        .toString(16)
        .padStart(6, "0")
        .toUpperCase(),
      alpha,
    };
  }
  return null;
}

// First color stop of a CSS gradient (best-effort flat fill). (←tt)
export function parseGradient(input: string | null | undefined): ParsedColor | null {
  if (!input || !input.includes("gradient(")) return null;
  const m = input.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
  return m ? parseColor(m[0]) : null;
}

// CSS opacity (0..1) → PptxGenJS transparency percent (0..100). (←ee)
export function opacityToTransparency(alpha: number): number {
  return clamp(Math.round((1 - alpha) * 100), 0, 100);
}
