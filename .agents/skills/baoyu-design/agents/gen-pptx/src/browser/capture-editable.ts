// Browser-context only. Reveals slide N, settles layout, waits for images, then
// walks the live DOM into a JSON tree the Node renderer consumes. (←_t)

import type { FontSwap, Rect, SlideNode, SlideSpec, StyleMap } from "../types.ts";
import {
  STYLE_KEYS,
  COLOR_KEYS,
  makeColorNormalizer,
  makeFontResolver,
} from "./dom-style.ts";

export interface EditableCapture {
  slide: { rect: Rect; root: SlideNode };
  hash: number;
  imagesWaited: number;
  imagesFailed: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const settleFrame = (): Promise<void> =>
  Promise.race([
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    sleep(500),
  ]);

export async function captureEditable(
  spec: SlideSpec,
  fontSwaps: FontSwap[],
): Promise<EditableCapture> {
  if (spec.showJs) {
    try {
      new Function(spec.showJs)();
    } catch (e) {
      throw new Error("showJs threw: " + ((e as Error)?.message || e));
    }
  }
  await settleFrame();
  const delay = Number.isFinite(Number(spec.delay)) ? Number(spec.delay ?? 600) : 600;
  await sleep(delay);

  const rootEl = document.querySelector(spec.selector);
  if (!rootEl) throw new Error("selector " + JSON.stringify(spec.selector) + " matched nothing");

  // Image decode wait — shared budget that fits inside the eval timeout.
  const imgBudget = Math.max(1000, 8500 - delay);
  let waited = 0;
  let settled = 0;
  let failed = 0;
  const pending: Promise<void>[] = [];
  const queue = (img: HTMLImageElement): void => {
    waited++;
    pending.push(
      img.decode().then(
        () => {
          settled++;
        },
        () => {
          settled++;
          failed++;
        },
      ),
    );
  };
  for (const img of Array.from(rootEl.querySelectorAll("img"))) {
    if (img.complete && img.naturalWidth > 0) continue;
    queue(img);
  }
  for (const host of Array.from(rootEl.querySelectorAll("*"))) {
    if (!host.shadowRoot || host.firstElementChild || host.shadowRoot.querySelector("slot")) continue;
    for (const hImg of Array.from(host.shadowRoot.querySelectorAll("img"))) {
      if (!(hImg.currentSrc || hImg.src)) continue;
      const cs = getComputedStyle(hImg);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") continue;
      const rect = hImg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (hImg.complete && hImg.naturalWidth > 0) continue;
      queue(hImg);
    }
  }
  if (pending.length) {
    await Promise.race([Promise.all(pending), sleep(imgBudget)]);
    failed += pending.length - settled;
  }

  const { normColor, isTransparentColor } = makeColorNormalizer();
  const swapMap: Record<string, string> = {};
  for (const s of fontSwaps) swapMap[s.from.toLowerCase()] = s.to;
  const resolveFontFace = makeFontResolver(swapMap);

  // djb2 — fast, non-crypto; just "did slide N === slide N+1".
  let h = 5381;
  const hashStr = (s: string): void => {
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  };
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };

  const readStyle = (cs: CSSStyleDeclaration): StyleMap => {
    const style: StyleMap = {};
    const csm = cs as unknown as Record<string, string>;
    for (const k of STYLE_KEYS) {
      let v = csm[k];
      if (COLOR_KEYS.indexOf(k) >= 0) v = normColor(v) ?? v;
      if (k === "fontFamily" && v) v = resolveFontFace(v);
      style[k] = v;
    }
    return style;
  };

  const walk = (el: Element): SlideNode | null => {
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;

    const r = rectOf(el);
    const kids = el.children;
    if (r.w === 0 && r.h === 0 && kids.length === 0) return null;

    const style = readStyle(cs);
    const node: SlideNode = { tag: el.tagName.toLowerCase(), rect: r, style, children: [] };

    hashStr(`${r.x},${r.y},${r.w},${r.h}`);

    if (el.tagName === "A") {
      const a = el as HTMLAnchorElement;
      if (a.href && !(el.getAttribute("href") || "").startsWith("#")) node.href = a.href;
    }

    if (el.tagName === "LI") {
      const lst = cs.listStyleType;
      if (lst && lst !== "none" && lst !== "disc" && lst !== "circle" && lst !== "square") {
        const sibs: Element[] = [];
        for (let s = el.parentElement?.firstElementChild ?? null; s; s = s.nextElementSibling) {
          if (s.tagName === "LI") sibs.push(s);
        }
        node.liIndex = sibs.indexOf(el) + 1;
      }
    }

    // Pre-transform AABB for rotated elements.
    if (cs.transform && cs.transform !== "none") {
      const ow = (el as HTMLElement).offsetWidth;
      const oh = (el as HTMLElement).offsetHeight;
      if (ow != null && oh != null && (ow !== r.w || oh !== r.h)) {
        node.untransformedRect = { x: r.x + r.w / 2 - ow / 2, y: r.y + r.h / 2 - oh / 2, w: ow, h: oh };
      }
    }

    if (el.tagName === "IMG") {
      const img = el as HTMLImageElement;
      node.imageUrl = img.currentSrc || img.src;
    } else if (el.tagName === "OBJECT" && (el as HTMLObjectElement).data) {
      node.imageUrl = (el as HTMLObjectElement).data;
      return node;
    } else if (el.tagName === "CANVAS") {
      try {
        node.imageUrl = (el as HTMLCanvasElement).toDataURL("image/png");
      } catch {
        /* tainted canvas — skip */
      }
    } else if (el.tagName.toLowerCase() === "svg") {
      const clone = el.cloneNode(true) as Element;
      for (const ref of Array.from(clone.querySelectorAll("image"))) {
        const href =
          ref.getAttribute("href") || ref.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href && href.indexOf("data:") !== 0) {
          try {
            ref.setAttribute("href", new URL(href, location.href).href);
            ref.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
          } catch {
            /* leave href as-is */
          }
        }
      }
      node.svg = (clone as Element).outerHTML;
      return node;
    } else {
      // Shadow-hosted image (e.g. <image-slot>): a slotless light-empty host
      // renders only its shadow img, which IS the content.
      if (el.shadowRoot && !el.firstElementChild && !el.shadowRoot.querySelector("slot")) {
        for (const simg of Array.from(el.shadowRoot.querySelectorAll("img"))) {
          const scs = getComputedStyle(simg);
          if (scs.display === "none" || scs.visibility === "hidden" || scs.visibility === "collapse") continue;
          const ssrc = simg.currentSrc || simg.src;
          if (!ssrc) continue;
          const srect = simg.getBoundingClientRect();
          if (srect.width === 0 || srect.height === 0) continue;
          let sop = parseFloat(scs.opacity);
          if (isNaN(sop)) sop = 1;
          for (let anc = simg.parentElement; anc && sop > 0; anc = anc.parentElement) {
            const aop = parseFloat(getComputedStyle(anc).opacity);
            if (!isNaN(aop)) sop *= aop;
          }
          if (sop === 0) continue;
          node.imageUrl = ssrc;

          let sfit = el.getAttribute("fit");
          if (sfit !== "contain" && sfit !== "fill") {
            sfit = scs.objectFit === "contain" ? "contain" : "cover";
          }
          const override: StyleMap = { objectFit: sfit, backgroundSize: "auto", backgroundImage: "none" };

          const sideBorderPaints = (w: string, st: string, col: string): boolean =>
            (parseFloat(w) || 0) > 0 && !!st && st !== "none" && !isTransparentColor(normColor(col));
          const paintsOutsetShadow = (bs: string): boolean => {
            if (!bs || bs === "none") return false;
            for (const part of bs.split(/,(?![^(]*\))/)) {
              if (/\binset\b/.test(part)) continue;
              const shCol = part.match(/rgba?\([^)]*\)/);
              if (shCol && isTransparentColor(shCol[0])) continue;
              return true;
            }
            return false;
          };
          const hostHasBox =
            !isTransparentColor(normColor(cs.backgroundColor)) ||
            paintsOutsetShadow(cs.boxShadow) ||
            sideBorderPaints(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor) ||
            sideBorderPaints(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor) ||
            sideBorderPaints(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor) ||
            sideBorderPaints(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor);
          if (!hostHasBox) {
            const sradius = simg.parentElement ? getComputedStyle(simg.parentElement).borderRadius : "";
            if (sradius && sradius !== "0px") override.borderRadius = sradius;
            if (sop < 1) {
              const hop = parseFloat(cs.opacity);
              override.opacity = String((isNaN(hop) ? 1 : hop) * sop);
            } else {
              const fbg = simg.parentElement
                ? normColor(getComputedStyle(simg.parentElement).backgroundColor)
                : "";
              if (fbg && !isTransparentColor(fbg)) override.backgroundColor = fbg;
            }
          }
          node.style = Object.assign({}, node.style, override);
          return node;
        }
      }
      const bg = cs.backgroundImage;
      if (bg && bg !== "none") {
        const m = bg.match(/url\("([^"]*)"\)/);
        if (m && m[1].indexOf("data:") !== 0) {
          try {
            node.imageUrl = new URL(m[1], location.href).href;
          } catch {
            /* leave unset */
          }
        } else if (bg.indexOf("gradient(") >= 0) {
          // Rasterized later so alpha-fading overlays keep their fade. (←gradient)
          node.gradient = bg;
          const minSide = Math.min(r.w, r.h);
          const corner = (cs.borderTopLeftRadius || "").split(" ")[0] || "";
          let rad = 0;
          if (corner.endsWith("%")) rad = (parseFloat(corner) / 100) * minSide;
          else if (corner.endsWith("px")) rad = parseFloat(corner) || 0;
          if (isFinite(rad) && rad > 0) node.gradientRadius = Math.min(rad, minSide / 2);
        }
      }
    }

    // Single childNodes pass keeps text interleaved with element children.
    const ws = cs.whiteSpace;
    const keepWs = ws === "pre" || ws === "pre-wrap" || ws === "pre-line" || ws === "break-spaces";
    const parts: SlideNode[] = [];
    let elKids = 0;
    for (let cn = el.firstChild; cn; cn = cn.nextSibling) {
      if (cn.nodeType === 3) {
        const raw = cn.textContent ?? "";
        const t = keepWs ? raw : raw.trim();
        if (!t) continue;
        const rg = document.createRange();
        if (keepWs) {
          rg.selectNodeContents(cn);
        } else {
          const lead = raw.length - raw.replace(/^\s+/, "").length;
          rg.setStart(cn, lead);
          rg.setEnd(cn, lead + t.length);
        }
        const tr = rg.getBoundingClientRect();
        parts.push({
          tag: "#text",
          rect: { x: tr.x, y: tr.y, w: tr.width, h: tr.height },
          style,
          text: t,
          children: [],
        });
        hashStr(t);
      } else if (cn.nodeType === 1) {
        const kid = walk(cn as Element);
        if (kid) {
          parts.push(kid);
          elKids++;
        }
      }
    }
    if (elKids === 0) {
      const txt = parts.map((p) => p.text).join(keepWs ? "" : " ");
      if (txt) node.text = txt;
    } else {
      node.children = parts;
    }
    return node;
  };

  const rootRect = rectOf(rootEl);
  const rootNode = walk(rootEl);
  if (!rootNode) throw new Error("slide root walked to null (display:none?)");

  // Promote an ancestor's solid background when the slide root is transparent.
  const rootBg = rootNode.style.backgroundColor;
  const rootBgImg = rootNode.style.backgroundImage || "";
  if (
    rootBgImg.indexOf("gradient(") < 0 &&
    (!rootBg || rootBg === "transparent" || /rgba?\([^)]*,\s*0\)$/.test(rootBg))
  ) {
    for (let p = rootEl.parentElement; p; p = p.parentElement) {
      if (p.shadowRoot) continue;
      const pbg = normColor(getComputedStyle(p).backgroundColor);
      if (pbg && pbg !== "transparent" && !/rgba?\([^)]*,\s*0\)$/.test(pbg)) {
        rootNode.style = Object.assign({}, rootNode.style, { backgroundColor: pbg });
        break;
      }
    }
  }

  return {
    slide: { rect: rootRect, root: rootNode },
    hash: h >>> 0,
    imagesWaited: waited,
    imagesFailed: failed,
  };
}
