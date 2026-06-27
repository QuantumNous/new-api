// CSS generic family keywords → PowerPoint-safe faces. Used Node-side; the
// in-page walk has its own GENERIC_MAP for capture-time resolution. (←rt)
export const GENERIC_FONT_MAP: Record<string, string> = {
  serif: "Georgia",
  "sans-serif": "Arial",
  monospace: "Courier New",
  "system-ui": "Arial",
  "-apple-system": "Arial",
  blinkmacsystemfont: "Arial",
  "ui-serif": "Georgia",
  "ui-sans-serif": "Arial",
  "ui-monospace": "Courier New",
  "ui-rounded": "Arial",
  cursive: "Comic Sans MS",
  fantasy: "Impact",
  math: "Cambria Math",
  emoji: "Segoe UI Emoji",
};

// Resolve a font-family value to a single face name. The capture step has
// usually already collapsed the stack to the rendered face; this maps any
// remaining swap/generic and strips quotes. (←ot)
export function resolveFontFamily(
  family: string | null | undefined,
  swapMap?: Record<string, string>,
): string {
  if (!family) return "Arial";
  const first = family
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!first) return "Arial";
  const lc = first.toLowerCase();
  if (swapMap) {
    for (const key in swapMap) if (key.toLowerCase() === lc) return swapMap[key];
  }
  return GENERIC_FONT_MAP[lc] ?? first;
}
