import type { SlideNode, StyleMap, Rect } from "../types.ts";
import { clamp, pxToPoints } from "../core/units.ts";
import { parseColor, opacityToTransparency } from "../core/color.ts";
import {
  extractPx,
  isBold,
  parseShadow,
  underlineStyle,
  normalizeText,
  isPreserveWhitespace,
} from "../core/css.ts";
import { resolveFontFamily } from "../core/fonts.ts";
import { imageKey } from "./media-cache.ts";

export interface TextFormat {
  color: string;
  transparency: number;
  bold: boolean;
  italic: boolean;
  underline?: { style: string; color?: string };
  strike?: boolean;
  fontFace: string;
  fontSize?: number;
  subscript?: boolean;
  superscript?: boolean;
  highlight?: string;
}

export interface TextRun {
  text: string;
  fmt: TextFormat;
  rect?: Rect;
  href?: string;
}

// Computed style → run formatting. (←fe)
export function textFormat(style: StyleMap, swapMap?: Record<string, string>): TextFormat {
  const color = parseColor(style.color) || { hex: "000000", alpha: 1 };
  const deco = `${style.textDecorationLine || ""} ${style.textDecoration || ""}`;
  const decoColor = parseColor(style.textDecorationColor);
  const underlineColor = decoColor && decoColor.hex !== color.hex ? decoColor.hex : undefined;
  const fontSizePx = extractPx(style.fontSize);
  return {
    color: color.hex,
    transparency: opacityToTransparency(color.alpha),
    bold: isBold(style.fontWeight),
    italic: style.fontStyle === "italic" || (style.fontStyle || "").startsWith("oblique"),
    underline: deco.includes("underline")
      ? { style: underlineStyle(style.textDecorationStyle), color: underlineColor }
      : undefined,
    strike: deco.includes("line-through") ? true : undefined,
    fontFace: resolveFontFamily(style.fontFamily, swapMap),
    fontSize: fontSizePx > 0 ? clamp(pxToPoints(fontSizePx), 1, 400) : undefined,
  };
}

// text-transform → a function applied to run text. (←Se)
export function textTransformFn(value: string | null | undefined): (s: string) => string {
  switch (value) {
    case "uppercase":
      return (s) => s.toUpperCase();
    case "lowercase":
      return (s) => s.toLowerCase();
    case "capitalize":
      return (s) =>
        s.replace(
          new RegExp("(^|[^\\p{L}\\p{N}'\\u2019])(\\p{L})", "gu"),
          (_m, pre, ch) => pre + ch.toUpperCase(),
        );
    default:
      return (s) => s;
  }
}

const INLINE_MERGE_KEYS = ["textTransform", "letterSpacing"];

// Can this child fold into the parent's single text box without losing meaning? (←bt/wt)
function isRunMergeable(node: SlideNode, parentStyle: StyleMap): boolean {
  if (node.tag === "#text") return true;
  const s = node.style;
  const display = s.display || "";
  if (
    (display !== "inline" &&
      display !== "inline-block" &&
      display !== "inline-flex" &&
      display !== "contents") ||
    s.visibility === "hidden" ||
    (s.opacity && s.opacity !== "1")
  ) {
    return false;
  }
  const valign = s.verticalAlign || "baseline";
  if (
    (valign !== "baseline" &&
      valign !== "sub" &&
      valign !== "super" &&
      valign !== "0px" &&
      valign !== "0") ||
    imageKey(node) ||
    (parseColor(s.backgroundColor) &&
      extractPx(s.paddingTop) +
        extractPx(s.paddingRight) +
        extractPx(s.paddingBottom) +
        extractPx(s.paddingLeft) >
        0) ||
    extractPx(s.borderTopWidth || s.borderWidth) > 0 ||
    extractPx(s.borderBottomWidth) > 0 ||
    extractPx(s.borderLeftWidth) > 0 ||
    extractPx(s.borderRightWidth) > 0 ||
    parseShadow(s.boxShadow) ||
    parseShadow(s.textShadow)
  ) {
    return false;
  }
  for (const k of INLINE_MERGE_KEYS) if ((s[k] || "") !== (parentStyle[k] || "")) return false;
  return true;
}

export type VAlign = "top" | "middle" | "bottom";

// Vertical alignment inferred from flex/table-cell. (←yt)
export function valignFromBox(style: StyleMap): VAlign {
  if (style.display === "flex" || style.display === "inline-flex") {
    const v = (style.flexDirection || "").startsWith("column")
      ? style.justifyContent
      : style.alignItems;
    if (v === "center") return "middle";
    if (v === "flex-end" || v === "end") return "bottom";
  }
  if (style.display === "table-cell") {
    if (style.verticalAlign === "middle") return "middle";
    if (style.verticalAlign === "bottom") return "bottom";
  }
  return "top";
}

// Horizontal alignment inferred from a flex container. (←vt)
export function alignFromFlex(style: StyleMap): "center" | "right" | undefined {
  if (style.display !== "flex" && style.display !== "inline-flex") return undefined;
  const a = (style.flexDirection || "").startsWith("column")
    ? style.alignItems
    : style.justifyContent;
  if (a === "center") return "center";
  if (a === "flex-end" || a === "end") return "right";
  return undefined;
}

// http(s) hyperlink or undefined. (←Oe)
export function httpHref(href: string | null | undefined): string | undefined {
  return href && /^https?:\/\//i.test(href) ? href : undefined;
}

// Two run formats identical enough to merge? (←St)
function formatsEqual(a: TextFormat, b: TextFormat): boolean {
  return (
    a.color === b.color &&
    a.transparency === b.transparency &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.fontFace === b.fontFace &&
    a.fontSize === b.fontSize &&
    !!a.underline === !!b.underline &&
    a.underline?.style === b.underline?.style &&
    a.underline?.color === b.underline?.color &&
    !!a.strike === !!b.strike &&
    !!a.subscript === !!b.subscript &&
    !!a.superscript === !!b.superscript &&
    a.highlight === b.highlight
  );
}

// Horizontal adjacency — used to decide whether a separating space is needed. (←je)
export function runsAdjacent(a: TextRun, b: TextRun): boolean {
  if (!a.rect || !b.rect) return false;
  const gap = b.rect.x - (a.rect.x + a.rect.w);
  return gap >= -1 && gap < 2;
}

interface InheritedRunCtx {
  href?: string;
  baseline?: "sub" | "super";
  underline?: { style: string; color?: string };
  strike?: boolean;
  highlight?: string;
}

// Recursive inline walk that splits a node's text into formatted runs and
// reports which descendant nodes it consumed (so the renderer skips them). (←xt)
export function extractTextRuns(
  node: SlideNode,
  swapMap?: Record<string, string>,
): { runs: TextRun[]; consumed: Set<SlideNode> } {
  const consumed = new Set<SlideNode>();
  const collected: TextRun[] = [];

  const ownText = node.text ? normalizeText(node.text, node.style.whiteSpace) : "";
  if (ownText) collected.push({ text: ownText, fmt: textFormat(node.style, swapMap), rect: node.rect });

  const allMergeable = (n: SlideNode): boolean =>
    isRunMergeable(n, node.style) ? n.children.every(allMergeable) : false;

  const absorb = (n: SlideNode, inherited?: InheritedRunCtx): void => {
    consumed.add(n);
    if (n.tag !== "#text" && (n.style.visibility === "hidden" || n.style.opacity === "0")) return;
    if (n.tag === "br") {
      collected.push({ text: "\n", fmt: textFormat(n.style, swapMap), rect: n.rect });
      return;
    }
    const href = httpHref(n.href) || inherited?.href;
    const fmt = textFormat(n.style, swapMap);
    const valign = n.style.verticalAlign;
    const baseline: "sub" | "super" | undefined =
      valign === "sub" ? "sub" : valign === "super" ? "super" : inherited?.baseline;
    if (baseline === "sub") fmt.subscript = true;
    else if (baseline === "super") fmt.superscript = true;
    if (!fmt.underline && inherited?.underline) fmt.underline = inherited.underline;
    if (!fmt.strike && inherited?.strike) fmt.strike = true;
    const bg = parseColor(n.style.backgroundColor);
    const highlight = bg ? bg.hex : inherited?.highlight;
    if (highlight) fmt.highlight = highlight;
    const text = n.text ? normalizeText(n.text, n.style.whiteSpace) : "";
    if (text) collected.push({ text, fmt, rect: n.rect, href });
    for (const child of n.children) {
      absorb(child, { href, baseline, underline: fmt.underline, strike: fmt.strike, highlight });
    }
  };

  if (node.children.length > 0) {
    const hasDirectText = node.children.some((c) => c.tag === "#text");
    const hasMedia = (n: SlideNode): boolean => !!imageKey(n) || n.children.some(hasMedia);
    const allInlineNoMedia = node.children.every((c) => {
      if (c.tag === "#text") return true;
      if (hasMedia(c)) return false;
      const display = c.style.display || "";
      return (
        display === "inline" ||
        display === "inline-block" ||
        display === "inline-flex" ||
        display === "contents"
      );
    });
    if (node.children.every(allMergeable) || (hasDirectText && allInlineNoMedia)) {
      for (const child of node.children) absorb(child);
    }
  }

  // Coalesce adjacent runs with identical formatting + href. A separating space
  // is never inserted across a line break or when whitespace is preserved.
  const preserveWs = isPreserveWhitespace(node.style.whiteSpace);
  const merged: TextRun[] = [];
  for (const run of collected) {
    const last = merged.at(-1);
    if (last && last.href === run.href && formatsEqual(last.fmt, run.fmt)) {
      const sep =
        preserveWs ||
        runsAdjacent(last, run) ||
        last.text.endsWith("\n") ||
        run.text.startsWith("\n")
          ? ""
          : " ";
      last.text += sep + run.text;
      last.rect = run.rect;
    } else {
      merged.push({ ...run });
    }
  }
  // Block-level trim: newlines that only lead/trail the whole block are noise
  // (the `<pre>\n …\n</pre>` idiom); interior breaks between runs are kept.
  if (merged.length > 0) {
    merged[0].text = merged[0].text.replace(/^\n+/, "");
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\n+$/, "");
  }
  return { runs: merged.filter((r) => r.text !== ""), consumed };
}
