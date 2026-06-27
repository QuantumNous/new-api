// Unit conversions. Browsers report CSS px; PptxGenJS positions in inches and
// sizes fonts/borders in points. (←Ze/et/g/K/S in the bundle.)

export const DPI = 96;
export const PX_TO_PT = 0.75;

/** CSS px → inches. */
export const pxToInches = (px: number): number => px / DPI;

/** CSS px → points. */
export const pxToPoints = (px: number): number => px * PX_TO_PT;

/** Clamp to [lo, hi]; non-finite falls back to lo. */
export function clamp(value: number, lo: number, hi: number): number {
  return Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : lo;
}
