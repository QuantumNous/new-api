import type { SlideNode } from "../types.ts";
import { parseColor } from "../core/color.ts";
import { normalizeText } from "../core/css.ts";
import { imageKey } from "./media-cache.ts";

export interface ListStyleConfig {
  isNum: boolean;
  numberType?: string;
  characterCode?: string;
}

// list-style-type → PptxGenJS bullet config. (←Pe)
export function listStyleConfig(value: string): ListStyleConfig {
  switch (value) {
    case "decimal":
    case "decimal-leading-zero":
      return { isNum: true };
    case "lower-alpha":
    case "lower-latin":
      return { isNum: true, numberType: "alphaLcPeriod" };
    case "upper-alpha":
    case "upper-latin":
      return { isNum: true, numberType: "alphaUcPeriod" };
    case "lower-roman":
      return { isNum: true, numberType: "romanLcPeriod" };
    case "upper-roman":
      return { isNum: true, numberType: "romanUcPeriod" };
    case "circle":
      return { isNum: false, characterCode: "25CB" };
    case "square":
      return { isNum: false, characterCode: "25A0" };
    default:
      return { isNum: false };
  }
}

// Style keys that must match across <li> for the list to render as one box. (←Ct)
const LIST_UNIFORM_KEYS = [
  "color",
  "fontWeight",
  "fontStyle",
  "fontFamily",
  "fontSize",
  "textDecorationLine",
  "textDecoration",
  "textDecorationStyle",
  "textDecorationColor",
  "textTransform",
  "letterSpacing",
  "textShadow",
];

// A <ul>/<ol> of uniformly-styled plain-text <li> → array of item strings,
// else null (render each child normally). (←kt)
export function detectList(node: SlideNode): string[] | null {
  if (node.tag !== "ul" && node.tag !== "ol") return null;
  const items: string[] = [];
  const first = node.children[0];
  for (const li of node.children) {
    if (
      li.tag !== "li" ||
      li.style.visibility === "hidden" ||
      li.style.opacity === "0" ||
      li.children.length > 0 ||
      imageKey(li) ||
      parseColor(li.style.backgroundColor)
    ) {
      return null;
    }
    for (const k of LIST_UNIFORM_KEYS) {
      if ((li.style[k] || "") !== (first.style[k] || "")) return null;
    }
    const text = li.text ? normalizeText(li.text, li.style.whiteSpace) : "";
    if (!text) return null;
    items.push(text);
  }
  return items.length > 0 ? items : null;
}
