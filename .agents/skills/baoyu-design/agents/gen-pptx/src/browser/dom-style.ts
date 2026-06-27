// Browser-context only. Self-contained: imports nothing from core/ or render/
// so esbuild's IIFE bundle stays sealed. Computed-style read list + the
// font/color resolution closures used by the DOM walk. (←Mt/Rt/At + the
// normColor/faceAvailable/resolveFontFace helpers inside _t.)

// Computed-style properties to capture per node. Deduped from the reference's
// Mt (which listed objectFit/textShadow twice — a harmless read bug). (←[...Mt, ...Rt])
export const STYLE_KEYS = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "objectFit",
  "objectPosition",
  "borderTopWidth",
  "borderTopStyle",
  "borderTopColor",
  "borderRightWidth",
  "borderRightStyle",
  "borderRightColor",
  "borderBottomWidth",
  "borderBottomStyle",
  "borderBottomColor",
  "borderLeftWidth",
  "borderLeftStyle",
  "borderLeftColor",
  "borderRadius",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textDecoration",
  "textDecorationStyle",
  "textDecorationColor",
  "textAlign",
  "textTransform",
  "lineHeight",
  "letterSpacing",
  "opacity",
  "textShadow",
  "transform",
  "boxShadow",
  "listStyleType",
  "display",
  "visibility",
  "whiteSpace",
  "textOverflow",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "overflow",
  // Rt:
  "flexDirection",
  "alignItems",
  "justifyContent",
  "verticalAlign",
  "position",
  "zIndex",
] as const;

// Keys whose value is a color, normalized through a canvas round-trip. (←At)
export const COLOR_KEYS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "textDecorationColor",
];

// CSS generic keywords → PowerPoint-safe family. Never in document.fonts and
// not names PowerPoint recognises. (←GENERIC_MAP inside _t.)
const GENERIC_MAP: Record<string, string> = {
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

export interface ColorNormalizer {
  normColor(c: string | null | undefined): string | null | undefined;
  isTransparentColor(c: string | null | undefined): boolean;
}

// Canvas fillStyle round-trip resolves oklch()/lab()/named colors to hex/rgb.
// Reset to a known value before assignment so an unparseable input is
// detectable. (←normColor/isTransparentColor inside _t.)
export function makeColorNormalizer(): ColorNormalizer {
  const ctx = document.createElement("canvas").getContext("2d");
  const isTransparentColor = (c: string | null | undefined): boolean =>
    !c || c === "transparent" || (c.indexOf("rgba(") === 0 && /,\s*0\)$/.test(c));
  const normColor = (c: string | null | undefined): string | null | undefined => {
    if (!c || !ctx) return c;
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    return ctx.fillStyle;
  };
  return { normColor, isTransparentColor };
}

// Resolve a font-family stack to the face the browser actually rendered with —
// applying swaps and generic mappings, and probing availability via canvas
// metrics so an unbacked first name doesn't leak into the .pptx. (←faceAvailable
// + resolveFontFace inside _t.)
export function makeFontResolver(swapMap: Record<string, string>): (stack: string) => string {
  const ctx = document.createElement("canvas").getContext("2d");
  const cache: Record<string, boolean> = {};
  let monoW: number | undefined;
  let sansW: number | undefined;
  const probe = "BESbswy—MWmi0Il1";

  const faceAvailable = (face: string): boolean => {
    if (!ctx) return true;
    const lc = face.toLowerCase();
    if (lc in cache) return cache[lc];
    if (monoW == null) {
      ctx.font = "72px monospace";
      monoW = ctx.measureText(probe).width;
      ctx.font = "72px sans-serif";
      sansW = ctx.measureText(probe).width;
    }
    const q = JSON.stringify(face);
    ctx.font = `72px ${q}, monospace`;
    const wm = ctx.measureText(probe).width;
    ctx.font = `72px ${q}, sans-serif`;
    const ws = ctx.measureText(probe).width;
    return (cache[lc] = Math.abs(wm - (monoW as number)) > 0.01 || Math.abs(ws - (sansW as number)) > 0.01);
  };

  return (stack: string): string => {
    let first: string | null = null;
    for (const part of stack.split(",")) {
      const face = part.trim().replace(/^['"]|['"]$/g, "");
      if (!face) continue;
      if (first === null) first = face;
      const lc = face.toLowerCase();
      if (swapMap[lc]) return swapMap[lc];
      if (GENERIC_MAP[lc]) return GENERIC_MAP[lc];
      if (faceAvailable(face)) return face;
    }
    return first || "Arial";
  };
}
