// VChart default light-theme data schemes — the exact palette the console
// rankings page chart uses, so every surface (console /rankings, homepage
// usage chart, website /rankings) looks identical. Series order follows the
// rankings history order (largest model first → slot 1).
//
// dataviz note: CVD separation passes (worst adjacent ΔE 24); the lightness /
// contrast warnings are accepted for cross-surface consistency with the
// console chart, with relief provided by legends, native tooltips, and the
// leaderboard table next to every chart that uses this scheme.
export const VCHART_SCHEME_10 = ["#1664FF", "#1AC6FF", "#FF8A00", "#3CC780", "#7442D4", "#FFC400", "#304D77", "#B48DEB", "#009488", "#FF7DDA"];
export const VCHART_SCHEME_20 = ["#1664FF", "#B2CFFF", "#1AC6FF", "#94EFFF", "#FF8A00", "#FFCE7A", "#3CC780", "#B9EDCD", "#7442D4", "#DDC5FA", "#FFC400", "#FAE878", "#304D77", "#8B959E", "#B48DEB", "#EFE3FF", "#009488", "#59BAA8", "#FF7DDA", "#FFCFEE"];

export function seriesColor(index: number, count: number): string {
  const scheme = count > VCHART_SCHEME_10.length ? VCHART_SCHEME_20 : VCHART_SCHEME_10;
  return scheme[index % scheme.length];
}
