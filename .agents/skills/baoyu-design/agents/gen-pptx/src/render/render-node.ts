import type { SlideNode } from "../types.ts";
import { pxToInches, pxToPoints, clamp } from "../core/units.ts";
import { parseColor, parseGradient, opacityToTransparency } from "../core/color.ts";
import {
  extractPx,
  parseBorderRadius,
  extractRotation,
  parseShadow,
  borderStyleToDashType,
  textAlign,
  lineSpacingMultiple,
  letterSpacingPoints,
  noWrap,
  normalizeText,
  isPreserveWhitespace,
  trimBlockNewlines,
} from "../core/css.ts";
import { type RenderContext, rectToPptx } from "./context.ts";
import { imageKey } from "./media-cache.ts";
import {
  type TextRun,
  textFormat,
  extractTextRuns,
  textTransformFn,
  valignFromBox,
  alignFromFlex,
  httpHref,
  runsAdjacent,
} from "./text-runs.ts";
import { detectList, listStyleConfig } from "./list.ts";

type Opts = Record<string, unknown>;

const PT_PER_INCH = 72;

// Render a captured node (and its subtree) into the slide. `inheritedOpacity` is
// the multiplied opacity of all ancestors — CSS `opacity` forms a group that
// fades the whole subtree, but a flattened .pptx has no groups, so we propagate
// it down and multiply each element's own opacity by it. (←ce)
export function renderNodeToPptx(
  node: SlideNode,
  ctx: RenderContext,
  inheritedOpacity = 1,
): void {
  // ---- text leaf ----
  if (node.tag === "#text") {
    const style = node.style;
    const text = node.text ? trimBlockNewlines(normalizeText(node.text, style.whiteSpace)) : "";
    if (!text || node.rect.w < 0.5 || node.rect.h < 0.5 || style.visibility === "hidden") return;
    const coords = rectToPptx(node.rect, ctx);
    const fmt = textFormat(style, ctx.fontMap);
    const fontSize = fmt.fontSize ?? clamp(pxToPoints(extractPx(style.fontSize) || 16), 1, 400);
    const opacity = inheritedOpacity * clamp(parseFloat(style.opacity ?? "1") || 1, 0, 1);
    const widthPad = pxToInches(Math.max(8, node.rect.w * 0.03));
    try {
      ctx.slide.addText(textTransformFn(style.textTransform)(text), {
        x: coords.x,
        y: coords.y,
        w: coords.w + widthPad,
        h: coords.h + pxToInches(4),
        margin: 0,
        fontFace: fmt.fontFace,
        fontSize,
        bold: fmt.bold,
        italic: fmt.italic,
        underline: fmt.underline,
        strike: fmt.strike,
        color: fmt.color,
        transparency: opacityToTransparency((1 - fmt.transparency / 100) * opacity),
        align: textAlign(style.textAlign),
        valign: "top",
        fit: "shrink",
        wrap: !noWrap(style),
        lineSpacingMultiple: lineSpacingMultiple(style.lineHeight, fontSize),
        charSpacing: letterSpacingPoints(style.letterSpacing),
      });
    } catch (err) {
      ctx.warnings.push(`addText(#text) failed: ${errMsg(err)}`);
    }
    return;
  }

  const style = node.style;
  const opacity = inheritedOpacity * clamp(parseFloat(style.opacity ?? "1") || 1, 0, 1);
  if (node.rect.w < 0.5 || node.rect.h < 0.5) {
    for (const child of node.children) renderNodeToPptx(child, ctx, opacity);
    return;
  }
  if (style.display === "none" || style.opacity === "0") return;
  if (style.visibility === "hidden") {
    for (const child of node.children) renderNodeToPptx(child, ctx, opacity);
    return;
  }

  const rotation = extractRotation(style.transform);
  const box = rotation !== undefined && node.untransformedRect ? node.untransformedRect : node.rect;
  const coords = rectToPptx(box, ctx);
  const minSide = Math.min(box.w, box.h);
  const radiusPx = parseBorderRadius(style.borderTopLeftRadius || style.borderRadius, minSide);
  const radiusRatio = minSide > 0 ? radiusPx / minSide : 0;

  // A rasterized gradient (drawn as an image below) replaces the flat first-stop
  // fill; fall back to that flat fill only when rasterization was unavailable.
  const hasRasterGradient = !!node.gradient && !!ctx.mediaCache.get(imageKey(node) ?? "");
  const bgColor =
    parseColor(style.backgroundColor) ||
    (node.imageUrl || hasRasterGradient ? null : parseGradient(style.backgroundImage));
  const bgFill = bgColor ? { hex: bgColor.hex, alpha: bgColor.alpha * opacity } : null;

  const topW = extractPx(style.borderTopWidth || style.borderWidth);
  const bottomW = extractPx(style.borderBottomWidth);
  const leftW = extractPx(style.borderLeftWidth);
  const rightW = extractPx(style.borderRightWidth);
  const anyBorder = topW || bottomW || leftW || rightW;
  const topColor = style.borderTopColor || style.borderColor;
  const bottomColor = style.borderBottomColor || style.borderColor;
  const leftColor = style.borderLeftColor || style.borderColor;
  const rightColor = style.borderRightColor || style.borderColor;
  const topStyle = style.borderTopStyle || style.borderStyle;
  const bottomStyle = style.borderBottomStyle || style.borderStyle;
  const leftStyle = style.borderLeftStyle || style.borderStyle;
  const rightStyle = style.borderRightStyle || style.borderStyle;
  const uniformBorder =
    topW > 0 &&
    topW === bottomW &&
    topW === leftW &&
    topW === rightW &&
    topColor === bottomColor &&
    topColor === leftColor &&
    topColor === rightColor &&
    topStyle === bottomStyle &&
    topStyle === leftStyle &&
    topStyle === rightStyle;
  const uniformBorderColor = uniformBorder ? parseColor(topColor) : null;
  const shadow = parseShadow(style.boxShadow);
  const dashType = borderStyleToDashType(style.borderTopStyle || style.borderStyle);

  // ---- background / uniform border / shadow shape ----
  if (bgFill || uniformBorderColor || shadow) {
    const opts: Opts = {
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      fill: bgFill
        ? { color: bgFill.hex, transparency: opacityToTransparency(bgFill.alpha) }
        : { type: "none" },
      line: uniformBorderColor
        ? {
            color: uniformBorderColor.hex,
            width: clamp(pxToPoints(topW), 0.25, 20),
            transparency: opacityToTransparency(uniformBorderColor.alpha * opacity),
            dashType,
          }
        : { type: "none" },
    };
    if (shadow) opts.shadow = { ...shadow, opacity: shadow.opacity * opacity };
    if (rotation !== undefined) opts.rotate = rotation;
    let shapeName = "rect";
    if (radiusRatio >= 0.49) {
      const aspect = box.w / box.h;
      if (aspect > 0.75 && aspect < 1.33) {
        shapeName = "ellipse";
      } else {
        shapeName = "roundRect";
        opts.rectRadius = pxToInches(radiusPx);
      }
    } else if (radiusPx > 0.5) {
      shapeName = "roundRect";
      opts.rectRadius = pxToInches(radiusPx);
    }
    try {
      ctx.slide.addShape(shapeName, opts);
    } catch (err) {
      ctx.warnings.push(`addShape failed for <${node.tag}>: ${errMsg(err)}`);
    }
  }

  // ---- per-side borders (non-uniform) ----
  if (!uniformBorder && anyBorder > 0) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rad = rotation !== undefined ? (rotation * Math.PI) / 180 : 0;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const side = (
      width: number,
      colorStr: string | undefined,
      px: number,
      py: number,
      pw: number,
      ph: number,
    ): void => {
      if (width <= 0) return;
      const color = parseColor(colorStr);
      if (!color) return;
      let ox = px;
      let oy = py;
      if (rotation !== undefined) {
        const dx = px + pw / 2 - cx;
        const dy = py + ph / 2 - cy;
        ox = cx + dx * cos - dy * sin - pw / 2;
        oy = cy + dx * sin + dy * cos - ph / 2;
      }
      try {
        const opts: Opts = {
          x: pxToInches(ox - ctx.originX),
          y: pxToInches(oy - ctx.originY),
          w: pxToInches(Math.max(pw, 1)),
          h: pxToInches(Math.max(ph, 1)),
          fill: { color: color.hex, transparency: opacityToTransparency(color.alpha * opacity) },
          line: { type: "none" },
        };
        if (rotation !== undefined) opts.rotate = rotation;
        ctx.slide.addShape("rect", opts);
      } catch {
        /* per-side border is best-effort */
      }
    };
    if (bottomW > 0) side(bottomW, bottomColor, box.x, box.y + box.h - bottomW, box.w, bottomW);
    if (topW > 0) side(topW, topColor, box.x, box.y, box.w, topW);
    if (leftW > 0) side(leftW, leftColor, box.x, box.y, leftW, box.h);
    if (rightW > 0) side(rightW, rightColor, box.x + box.w - rightW, box.y, rightW, box.h);
  }

  // ---- image / canvas / svg / background-image ----
  const key = imageKey(node);
  if (key) {
    const entry = ctx.mediaCache.get(key);
    if (entry) {
      const opts: Opts = { x: coords.x, y: coords.y, w: coords.w, h: coords.h, data: entry.dataUrl };
      const isMediaTag =
        node.tag === "img" || node.tag === "canvas" || node.tag === "svg" || node.tag === "object";
      const hasBgImage = !!style.backgroundImage && style.backgroundImage !== "none";
      const fit =
        (style.objectFit && (isMediaTag || (style.objectFit !== "fill" && !hasBgImage))
          ? style.objectFit
          : undefined) ||
        (style.backgroundSize === "cover"
          ? "cover"
          : style.backgroundSize === "contain"
            ? "contain"
            : undefined);
      if (fit === "cover" || fit === "contain") {
        opts.sizing = { type: fit, w: coords.w, h: coords.h };
        const centered = (pos: string | undefined): boolean => !pos || /^50%\s+50%$/.test(pos.trim());
        const objFitCentered =
          !!style.objectFit &&
          (isMediaTag || style.objectFit !== "fill") &&
          (style.objectFit === "cover" || style.objectFit === "contain") &&
          (isMediaTag ? centered(style.objectPosition) : !hasBgImage);
        const bgCentered =
          !isMediaTag && hasBgImage && /^50%\s+50%$/.test((style.backgroundPosition ?? "").trim());
        if (node.imageUrl && entry.w && entry.h && (objFitCentered || bgCentered)) {
          opts.w = pxToInches(entry.w);
          opts.h = pxToInches(entry.h);
        }
      }
      // Gradient PNGs are already clipped to their corner radius in canvas.
      if (radiusRatio >= 0.4 && !node.gradient) opts.rounding = true;
      if (opacity < 1) opts.transparency = clamp(Math.round((1 - opacity) * 100), 0, 100);
      if (rotation !== undefined) opts.rotate = rotation;
      try {
        ctx.slide.addImage(opts);
      } catch (err) {
        ctx.warnings.push(`addImage failed for <${node.tag}>: ${errMsg(err)}`);
      }
    }
    if (node.tag === "svg" || node.tag === "img" || node.tag === "canvas") return;
  }

  // ---- uniform-list shortcut ----
  const listItems = detectList(node);
  const consumed = new Set<SlideNode>();
  if (listItems) {
    const firstLi = node.children[0];
    const liStyle = firstLi.style;
    const listType = liStyle.listStyleType || "";
    const fontSize = clamp(pxToPoints(extractPx(liStyle.fontSize) || 16), 1, 400);
    const fmt = textFormat(liStyle, ctx.fontMap);
    const transform = textTransformFn(liStyle.textTransform);
    const cfg = listStyleConfig(listType);
    const indentPt = cfg.isNum ? Math.max(fontSize * 1.5, 14) : Math.max(fontSize * 0.7, 8);
    const lastLi = node.children[node.children.length - 1];
    const top = firstLi.rect.y - ctx.originY;
    const bottom = lastLi.rect.y + lastLi.rect.h - ctx.originY;
    const left = firstLi.rect.x - ctx.originX;
    const opts: Opts = {
      x: pxToInches(left) - indentPt / PT_PER_INCH,
      y: pxToInches(top),
      w: pxToInches(Math.max(firstLi.rect.w, 4)) + indentPt / PT_PER_INCH + pxToInches(8),
      h: pxToInches(Math.max(bottom - top, 4)) + pxToInches(4),
      margin: 2,
      fontFace: fmt.fontFace,
      fontSize,
      bold: fmt.bold,
      italic: fmt.italic,
      underline: fmt.underline,
      strike: fmt.strike,
      color: fmt.color,
      transparency: clamp(Math.round(100 - (100 - fmt.transparency) * opacity), 0, 100),
      align: textAlign(liStyle.textAlign),
      valign: "top",
      fit: "shrink",
      wrap: !noWrap(liStyle),
      lineSpacingMultiple: lineSpacingMultiple(liStyle.lineHeight, fontSize),
      charSpacing: letterSpacingPoints(liStyle.letterSpacing),
    };
    const listShadow = parseShadow(liStyle.textShadow);
    if (listShadow) opts.shadow = { ...listShadow, opacity: listShadow.opacity * opacity };
    const tabPos = indentPt / PT_PER_INCH;
    const bulletFor = (i: number): boolean | Opts =>
      listType === "none"
        ? false
        : cfg.isNum
          ? { type: "number", indent: indentPt, numberStartAt: i + 1, numberType: cfg.numberType }
          : { indent: indentPt, characterCode: cfg.characterCode };
    const textObjs = listItems.map((item, i) => ({
      text: transform(item),
      options: {
        bullet: bulletFor(i),
        tabStops: listType === "none" ? undefined : [{ position: tabPos }],
        breakLine: i < listItems.length - 1,
      },
    }));
    try {
      ctx.slide.addText(textObjs, opts);
    } catch (err) {
      ctx.warnings.push(`addText(list) failed: ${errMsg(err)}`);
    }
    for (const child of node.children) consumed.add(child);
  }

  // ---- inline text runs ----
  const { runs, consumed: runConsumed } = extractTextRuns(node, ctx.fontMap);
  for (const c of runConsumed) consumed.add(c);
  if (runs.length > 0) {
    const fontSize = clamp(pxToPoints(extractPx(style.fontSize) || 16), 1, 400);
    const valign = valignFromBox(style);
    const align = alignFromFlex(style) || textAlign(style.textAlign);
    const padTop = extractPx(style.paddingTop);
    const padBottom = extractPx(style.paddingBottom);
    const padLeft = extractPx(style.paddingLeft);
    const padRight = extractPx(style.paddingRight);
    const insetLeft = leftW + padLeft;
    const insetRight = rightW + padRight;
    const insetTop = topW + padTop;
    const insetBottom = bottomW + padBottom;
    const boxX = coords.x + pxToInches(insetLeft);
    const boxY = coords.y + pxToInches(insetTop);
    const boxW = Math.max(coords.w - pxToInches(insetLeft + insetRight), pxToInches(4));
    const boxH = Math.max(coords.h - pxToInches(insetTop + insetBottom), pxToInches(4));
    const extraW = pxToInches(Math.max(8, box.w * 0.03));
    const shiftX = align === "right" ? extraW : align === "center" ? extraW / 2 : 0;
    const opts: Opts = {
      x: boxX - shiftX,
      y: boxY,
      w: boxW + extraW,
      h: boxH + pxToInches(4),
      margin: 2,
      fontSize,
      align,
      valign,
      fit: "shrink",
      wrap: !noWrap(style),
      lineSpacingMultiple: lineSpacingMultiple(style.lineHeight, fontSize),
      charSpacing: letterSpacingPoints(style.letterSpacing),
    };
    if (rotation !== undefined) opts.rotate = rotation;
    const textShadow = parseShadow(style.textShadow);
    if (textShadow) opts.shadow = { ...textShadow, opacity: textShadow.opacity * opacity };
    if (node.tag === "li") {
      const listType = style.listStyleType || "";
      if (listType !== "none") {
        const cfg = listStyleConfig(listType);
        const indentPt = cfg.isNum ? Math.max(fontSize * 1.5, 14) : Math.max(fontSize * 0.7, 8);
        const indentIn = indentPt / PT_PER_INCH;
        opts.x = (opts.x as number) - indentIn;
        opts.w = (opts.w as number) + indentIn;
        opts.tabStops = [{ position: indentIn }];
        opts.bullet = cfg.isNum
          ? {
              type: "number",
              indent: indentPt,
              numberType: cfg.numberType,
              ...(node.liIndex ? { numberStartAt: node.liIndex } : {}),
            }
          : { indent: indentPt, characterCode: cfg.characterCode };
      }
    }
    const nodeHref = httpHref(node.href);
    if (nodeHref) opts.hyperlink = { url: nodeHref };
    const transform = textTransformFn(style.textTransform);
    if (runs.length === 1) {
      const run = runs[0];
      const alpha = (1 - run.fmt.transparency / 100) * opacity;
      if (!nodeHref && run.href) opts.hyperlink = { url: run.href };
      Object.assign(opts, {
        fontFace: run.fmt.fontFace,
        fontSize: run.fmt.fontSize ?? opts.fontSize,
        bold: run.fmt.bold,
        italic: run.fmt.italic,
        underline: run.fmt.underline,
        strike: run.fmt.strike,
        subscript: run.fmt.subscript,
        superscript: run.fmt.superscript,
        highlight: run.fmt.highlight,
        color: run.fmt.color,
        transparency: opacityToTransparency(alpha),
      });
      try {
        ctx.slide.addText(transform(run.text), opts);
      } catch (err) {
        ctx.warnings.push(`addText failed for <${node.tag}>: ${errMsg(err)}`);
      }
    } else {
      const preserveWs = isPreserveWhitespace(style.whiteSpace);
      const runOpts = (run: TextRun): Opts => {
        const alpha = (1 - run.fmt.transparency / 100) * opacity;
        return {
          fontFace: run.fmt.fontFace,
          fontSize: run.fmt.fontSize,
          bold: run.fmt.bold,
          italic: run.fmt.italic,
          underline: run.fmt.underline,
          strike: run.fmt.strike,
          subscript: run.fmt.subscript,
          superscript: run.fmt.superscript,
          highlight: run.fmt.highlight,
          color: run.fmt.color,
          transparency: opacityToTransparency(alpha),
          hyperlink: !nodeHref && run.href ? { url: run.href } : undefined,
        };
      };
      // Split runs on "\n" into visual lines, then emit each line break as an
      // explicit breakLine. (PptxGenJS renders "\n" embedded in a run that is
      // followed by another run on the same line incorrectly.)
      const lines: { text: string; options: Opts }[][] = [[]];
      runs.forEach((run, i) => {
        const segs = transform(run.text).split("\n");
        segs.forEach((seg, j) => {
          if (j > 0) lines.push([]);
          if (seg !== "") lines[lines.length - 1].push({ text: seg, options: runOpts(run) });
        });
        const next = runs[i + 1];
        const sep =
          !preserveWs &&
          next &&
          !runsAdjacent(run, next) &&
          !/\n$/.test(run.text) &&
          !/^\n/.test(next.text)
            ? " "
            : "";
        if (sep) {
          const cur = lines[lines.length - 1];
          if (cur.length) cur[cur.length - 1].text += sep;
        }
      });
      const lastLine = lines.length - 1;
      const textObjs: { text: string; options: Opts }[] = [];
      lines.forEach((line, li) => {
        const breakAfter = li < lastLine;
        if (line.length === 0) {
          textObjs.push({ text: "", options: { breakLine: breakAfter } });
          return;
        }
        line.forEach((piece, pi) => {
          textObjs.push({
            text: piece.text,
            options: { ...piece.options, breakLine: pi === line.length - 1 ? breakAfter : false },
          });
        });
      });
      try {
        ctx.slide.addText(textObjs, opts);
      } catch (err) {
        ctx.warnings.push(`addText(runs) failed for <${node.tag}>: ${errMsg(err)}`);
      }
    }
  }

  for (const child of orderByZIndex(node.children))
    if (!consumed.has(child)) renderNodeToPptx(child, ctx, opacity);
}

// Paint children in CSS stacking order: positioned siblings with a numeric
// z-index layer by that value (higher = painted later = on top); everything
// else keeps DOM order. Returns the original array untouched when no positioned
// child carries a non-zero z-index, so the common case is unaffected.
function orderByZIndex(children: SlideNode[]): SlideNode[] {
  const zOf = (n: SlideNode): number => {
    const pos = n.style.position;
    if (pos !== "relative" && pos !== "absolute" && pos !== "fixed" && pos !== "sticky") return 0;
    const v = parseInt(n.style.zIndex ?? "", 10);
    return Number.isNaN(v) ? 0 : v;
  };
  if (children.every((c) => zOf(c) === 0)) return children;
  return children
    .map((c, i) => ({ c, z: zOf(c), i }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((x) => x.c);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
